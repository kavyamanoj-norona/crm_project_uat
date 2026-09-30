import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { RULES, getNumberRule } from "@/server/rules";
import { BRANCH_COOKIE } from "@/server/branch-scope";
import {
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token";

const REMEMBER_DAYS = 7;

export async function createSession(payload: SessionPayload, remember: boolean) {
  const sessionHours = await getNumberRule(RULES.sessionHours, 12); // Master Settings → Rules
  const ms = remember
    ? REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : Math.max(1, sessionHours) * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ms);
  const token = await signSession(payload, expiresAt);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(BRANCH_COOKIE); // next user starts on their own scope
}

export type CurrentUser = {
  id: string;
  userCode: string;
  username: string;
  name: string;
  email: string;
  companyId: string;
  branchId: string | null;
  branch: { id: string; code: string; name: string } | null;
  defaultModuleId: string | null;
  privilege: {
    id: string;
    code: string;
    name: string;
    isSuperAdmin: boolean;
    /** Branch-bound privileges only ever see their own branch. */
    isBranchBound: boolean;
    homePath: string | null;
  };
};

/** True when a user row may sign in / keep a session. */
export function canSignIn(u: {
  isActive: boolean;
  isLocked: boolean;
  status: string;
  privilege: { isActive: boolean };
}) {
  return u.isActive && !u.isLocked && u.status === "WORKING" && u.privilege.isActive;
}

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    include: { privilege: true, branch: { select: { id: true, code: true, name: true } } },
  });
  if (!user || !canSignIn(user)) return null;

  const p = user.privilege;
  return {
    id: user.id,
    userCode: user.userCode,
    username: user.username,
    name: [user.firstName, user.lastName].filter(Boolean).join(" "),
    email: user.email,
    companyId: user.companyId,
    branchId: user.branchId,
    branch: user.branch,
    defaultModuleId: user.defaultModuleId,
    privilege: {
      id: p.id,
      code: p.code,
      name: p.name,
      isSuperAdmin: p.isSuperAdmin,
      isBranchBound: p.isBranchBound && !p.isSuperAdmin,
      homePath: p.homePath,
    },
  };
});

/** Use in (app) layouts and pages: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
