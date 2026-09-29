"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { formValues, pick, toFieldErrors, type FormState } from "@/lib/form";
import { hashPassword } from "@/server/auth/password";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { ADMIN_PATHS } from "../paths";
import { PASSWORD_MIN, USER_FIELDS, userSchema, type UserInput } from "../user-schema";

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
  const parsed = userSchema.safeParse(pick(formData, USER_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const id = formData.get("id")?.toString() || null;
  const { password, ...data } = parsed.data;
  // Required on create; on edit a blank password keeps the current one.
  if ((!id || password) && password.length < PASSWORD_MIN) {
    return {
      message: "Please fix the highlighted fields.",
      fieldErrors: { password: [`Password must be at least ${PASSWORD_MIN} characters`] },
      values: formValues(formData),
    };
  }

  const image = formData.get("image");
  const file = image instanceof File && image.size > 0 ? image : null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(ADMIN_PATHS.users, id ? "canEdit" : "canCreate");
    if (data.isPrimaryAdmin && !actor.privilege.isSuperAdmin) throw new ForbiddenError();
    await checkRelations(data);

    const passwordHash = password ? await hashPassword(password) : undefined;
    const user = id
      ? await db.user.update({ where: { id }, data: { ...data, ...(passwordHash ? { passwordHash } : {}) } })
      : await db.user.create({
          data: { ...data, passwordHash: passwordHash!, userCode: await nextUserCode(), createdById: actor.id },
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
  redirect(`${ADMIN_PATHS.users}?saved=1${id ? "" : `&highlight=${savedId}`}`);
}

const FLAGS = ["twoFactorEnabled", "isLocked", "isPrimaryAdmin", "isActive"] as const;
export type UserFlag = (typeof FLAGS)[number];

/** Flips one boolean flag on a user from the users table. */
export async function toggleUserFlag(id: string, flag: UserFlag) {
  if (!FLAGS.includes(flag)) throw new Error("Unknown flag");
  const actor = await requireActionPermission(ADMIN_PATHS.users, "canEdit");
  if (flag === "isPrimaryAdmin" && !actor.privilege.isSuperAdmin) throw new ForbiddenError();
  // Don't let admins lock themselves out.
  if (id === actor.id && flag !== "twoFactorEnabled") throw new ForbiddenError();

  const user = await db.user.findUnique({
    where: { id },
    select: { twoFactorEnabled: true, isLocked: true, isPrimaryAdmin: true, isActive: true },
  });
  if (!user) return;
  const next = !user[flag];
  await db.user.update({ where: { id }, data: { [flag]: next } });

  await logActivity({ action: `user.${flag}.${next ? "on" : "off"}`, userId: actor.id, entity: "User", entityId: id });
  revalidatePath(ADMIN_PATHS.users);
}
