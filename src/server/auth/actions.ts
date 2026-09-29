"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { isIpBlocked, logActivity, requestMeta } from "@/server/security/activity";
import { verifyPassword } from "./password";
import { canSignIn, createSession, deleteSession, getCurrentUser } from "./session";

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

  const { ip } = await requestMeta();
  if (await isIpBlocked(ip)) {
    await logActivity({ action: "login.blocked-ip", username });
    return { error: "Sign-in from this network is blocked. Contact your administrator." };
  }

  const user = await db.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
    include: { privilege: true },
  });

  // Same message for unknown user and wrong password (blueprint §6).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await logActivity({ action: "login.failed", userId: user?.id, username });
    return { error: INVALID };
  }
  if (!canSignIn(user)) {
    await logActivity({ action: "login.disabled", userId: user.id, username });
    return { error: "Your account is disabled. Contact your administrator." };
  }

  await createSession({ userId: user.id }, remember);
  await logActivity({ action: "login.success", userId: user.id, username: user.username });
  redirect("/");
}

export async function logout() {
  const user = await getCurrentUser();
  if (user) await logActivity({ action: "logout", userId: user.id, username: user.username });
  await deleteSession();
  redirect("/login");
}
