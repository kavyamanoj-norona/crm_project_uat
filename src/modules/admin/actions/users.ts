"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { hashPassword } from "@/server/auth/password";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { ADMIN_PATHS } from "../paths";
import {
  USER_FIELDS,
  createUserSchema,
  editUserSchema,
  passwordChangeSchema,
  type UserInput,
} from "../user-schema";

const LABELS = { username: "Username", email: "Email", mobile: "Mobile", userCode: "User ID" };
const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/** Next user code: LC00001, LC00002 … */
async function nextUserCode() {
  const last = await db.user.findFirst({ orderBy: { userCode: "desc" }, select: { userCode: true } });
  const n = last ? Number(last.userCode.replace(/\D/g, "")) + 1 : 1;
  return `LC${String(n).padStart(5, "0")}`;
}

/** Checks that picked options belong together (branch ∈ company, department ∈ domain). */
async function checkRelations(data: Omit<UserInput, "password">) {
  const [branch, department] = await Promise.all([
    db.branch.findUnique({ where: { id: data.branchId }, select: { companyId: true, isActive: true } }),
    db.department.findUnique({ where: { id: data.departmentId }, select: { domainId: true, isActive: true } }),
  ]);
  if (!branch || !branch.isActive || branch.companyId !== data.companyId)
    throw new FieldError("branchId", "Pick a branch of the selected company");
  if (!department || !department.isActive || department.domainId !== data.domainId)
    throw new FieldError("departmentId", "Pick a department of the selected domain");
}

/** Saves an uploaded photo under public/uploads/users. TODO: move to S3 (blueprint §13). */
async function saveImage(file: File, userId: string) {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) throw new FieldError("image", "Use a JPG, PNG or WebP image");
  if (file.size > IMAGE_MAX_BYTES) throw new FieldError("image", "Image must be 2 MB or smaller");
  const dir = path.join(process.cwd(), "public", "uploads", "users");
  await mkdir(dir, { recursive: true });
  const name = `${userId}-${Date.now()}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/users/${name}`;
}

export async function saveUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  // Create needs a password; edit never touches it (see changeUserPassword).
  const schema = id ? editUserSchema : createUserSchema;
  const parsed = schema.safeParse(pick(formData, USER_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { password, ...data } = { password: undefined as string | undefined, ...parsed.data };
  const image = formData.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(ADMIN_PATHS.users, id ? "canEdit" : "canCreate");
    await checkRelations(data);

    const user = id
      ? await db.user.update({ where: { id }, data })
      : await db.user.create({
          data: { ...data, passwordHash: await hashPassword(password!), userCode: await nextUserCode(), createdById: actor.id },
        });
    savedId = user.id;

    if (file) {
      await db.user.update({ where: { id: user.id }, data: { imageUrl: await saveImage(file, user.id) } });
    }
    await logActivity({ action: id ? "user.update" : "user.create", userId: actor.id, entity: "User", entityId: user.id });
  } catch (e) {
    return handleActionError(e, LABELS, formData);
  }

  revalidatePath(ADMIN_PATHS.users);
  redirect(`${ADMIN_PATHS.users}?saved=${Date.now()}${id ? "" : `&highlight=${savedId}`}`);
}

/** Change password dialog on the Users screen. Also clears any lockout. */
export async function changeUserPassword(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = passwordChangeSchema.safeParse(pick(formData, ["password", "confirmPassword"]));
  if (!parsed.success) return toFieldErrors(parsed.error);
  try {
    const actor = await requireActionPermission(ADMIN_PATHS.users, "canEdit");
    await db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(parsed.data.password), failedLoginCount: 0, lockedUntil: null },
    });
    await logActivity({ action: "user.password-change", userId: actor.id, entity: "User", entityId: userId });
  } catch (e) {
    return handleActionError(e);
  }
  return { ok: true, message: "Password changed." };
}

/** Locked by an admin, or automatically after too many failed sign-ins. */
function isUserLocked(u: { isLocked: boolean; lockedUntil: Date | null }) {
  return u.isLocked || (u.lockedUntil !== null && u.lockedUntil > new Date());
}

const FLAGS = ["twoFactorEnabled", "isLocked", "isActive"] as const;
export type UserFlag = (typeof FLAGS)[number];

const FLAG_MESSAGES: Record<UserFlag, [on: string, off: string]> = {
  twoFactorEnabled: ["Two-factor authentication turned on.", "Two-factor authentication turned off."],
  isLocked: ["User locked.", "User unlocked."],
  isActive: ["User enabled.", "User disabled."],
};

/** Flips one boolean flag on a user from the users table. */
export async function toggleUserFlag(id: string, flag: UserFlag): Promise<ActionResult> {
  if (!FLAGS.includes(flag)) return { ok: false, message: "Unknown option." };
  try {
    const actor = await requireActionPermission(ADMIN_PATHS.users, "canEdit");
    // Don't let admins lock themselves out.
    if (id === actor.id && flag !== "twoFactorEnabled") return { ok: false, message: "You can't change this on your own account." };

    const user = await db.user.findUnique({
      where: { id },
      select: { twoFactorEnabled: true, isLocked: true, isActive: true, lockedUntil: true },
    });
    if (!user) return { ok: false, message: "User not found." };
    const current = flag === "isLocked" ? isUserLocked(user) : user[flag];
    const next = !current;
    await db.user.update({
      where: { id },
      // Unlocking also clears an automatic lockout from failed sign-ins.
      data: flag === "isLocked" && !next ? { isLocked: false, lockedUntil: null, failedLoginCount: 0 } : { [flag]: next },
    });

    await logActivity({ action: `user.${flag}.${next ? "on" : "off"}`, userId: actor.id, entity: "User", entityId: id });
    revalidatePath(ADMIN_PATHS.users);
    return { ok: true, message: FLAG_MESSAGES[flag][next ? 0 : 1] };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
