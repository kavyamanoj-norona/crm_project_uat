"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { verifyPassword } from "./password";
import { createSession, deleteSession } from "./session";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username or email"),
  password: z.string().min(1, "Enter your password"),
  remember: z.boolean(),
});

export type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"username" | "password", string[]>>;
};

const INVALID = "Invalid username or password.";

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    remember: formData.get("remember") === "on",
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }

  const { username, password, remember } = parsed.data;
  const user = await db.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
    include: { role: true },
  });

  // Same message for unknown user and wrong password (blueprint §6).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: INVALID };
  }
  if (!user.isActive || !user.role.isActive) {
    return { error: "Your account is disabled. Contact your administrator." };
  }

  await createSession({ userId: user.id, roleId: user.roleId }, remember);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}
