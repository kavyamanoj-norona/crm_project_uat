"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { logActivity } from "@/server/security/activity";
import { toFieldErrors, formValues, pick, type FormState } from "@/lib/form";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(50, "First name must be 50 characters or fewer"),
  lastName: z.string().trim().max(50, "Last name must be 50 characters or fewer").optional().or(z.literal("")).transform((v) => (v === "" ? undefined : v)),
  email: z.string().trim().toLowerCase().min(1, "Email is required").email("Enter a valid email address"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(100, "New password must be 100 characters or fewer"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirmPassword"],
      });
    }
  });

// ─── updateProfile ────────────────────────────────────────────────────────────

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["firstName", "lastName", "email"]);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { firstName, lastName, email } = parsed.data;

  const user = await requireUser();

  // Check email uniqueness against other users
  const clash = await db.user.findFirst({
    where: { email, NOT: { id: user.id } },
    select: { id: true },
  });
  if (clash) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { email: ["This email is already in use by another account."] },
      values: formValues(formData),
    };
  }

  await db.user.update({
    where: { id: user.id },
    data: { firstName, lastName: lastName ?? null, email },
  });

  await logActivity({
    action: "user.profile.update",
    userId: user.id,
    entity: "User",
    entityId: user.id,
  });

  revalidatePath("/settings/profile", "layout");
  return { ok: true, message: "Profile updated." };
}

// ─── changePassword ───────────────────────────────────────────────────────────

export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["currentPassword", "newPassword", "confirmPassword"]);
  const parsed = passwordSchema.safeParse(raw);
  if (!parsed.success) {
    // Never echo password values back
    return {
      message: "Please fix the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await requireUser();

  // Fetch the stored password hash
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  if (!dbUser) return { ok: false, message: "User not found. Please sign in again." };

  const valid = await verifyPassword(currentPassword, dbUser.passwordHash);
  if (!valid) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      fieldErrors: { currentPassword: ["Incorrect current password."] },
    };
  }

  const newHash = await hashPassword(newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await logActivity({
    action: "user.password.change",
    userId: user.id,
    entity: "User",
    entityId: user.id,
  });

  revalidatePath("/settings/security", "layout");
  return { ok: true, message: "Password changed successfully." };
}
