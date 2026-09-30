"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { RULES, getNumberRule } from "@/server/rules";
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

function lockedMessage(until: Date) {
  const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }).format(until);
  return `Too many failed attempts. Your account is locked until ${time}.`;
}

/** Counts a failed sign-in; locks the account once the Rules limit is reached. */
async function recordFailedLogin(userId: string, attempts: number): Promise<Date | null> {
  const [max, minutes] = await Promise.all([
    getNumberRule(RULES.loginMaxAttempts, 5),
    getNumberRule(RULES.loginLockMinutes, 15),
  ]);
  if (max > 0 && attempts >= max) {
    const lockedUntil = new Date(Date.now() + minutes * 60_000);
    await db.user.update({ where: { id: userId }, data: { failedLoginCount: 0, lockedUntil } });
    await logActivity({ action: "user.auto-lock", userId, detail: `${attempts} failed attempts` });
    return lockedUntil;
  }
  await db.user.update({ where: { id: userId }, data: { failedLoginCount: attempts } });
  return null;
}

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

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await logActivity({ action: "login.locked", userId: user.id, username });
    return { error: lockedMessage(user.lockedUntil) };
  }

  // Same message for unknown user and wrong password (blueprint §6).
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    await logActivity({ action: "login.failed", userId: user?.id, username });
    if (user) {
      const lockedUntil = await recordFailedLogin(user.id, user.failedLoginCount + 1);
      if (lockedUntil) return { error: lockedMessage(lockedUntil) };
    }
    return { error: INVALID };
  }
  if (!canSignIn(user)) {
    await logActivity({ action: "login.disabled", userId: user.id, username });
    return { error: "Your account is disabled. Contact your administrator." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
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
