import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import {
  SESSION_COOKIE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./session-token";

const SESSION_HOURS = 12;
const REMEMBER_DAYS = 7;

export async function createSession(payload: SessionPayload, remember: boolean) {
  const ms = remember
    ? REMEMBER_DAYS * 24 * 60 * 60 * 1000
    : SESSION_HOURS * 60 * 60 * 1000;
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
}

export type CurrentUser = {
  id: string;
  username: string;
  name: string;
  email: string | null;
  role: { id: string; code: string; name: string; isSuperAdmin: boolean; homePath: string | null };
};

/** The signed-in user, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      isActive: true,
      role: {
        select: { id: true, code: true, name: true, isSuperAdmin: true, homePath: true, isActive: true },
      },
    },
  });
  if (!user || !user.isActive || !user.role.isActive) return null;

  const { id, username, name, email, role } = user;
  return {
    id,
    username,
    name,
    email,
    role: { id: role.id, code: role.code, name: role.name, isSuperAdmin: role.isSuperAdmin, homePath: role.homePath },
  };
});

/** Use in (app) layouts and pages: redirects to /login when signed out. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
