"use server";

import { db } from "@/server/db";
import { requireUser } from "@/server/auth/session";

const MAX_TOKENS_PER_USER = 10;

/**
 * Remembers this browser for the signed-in user. A token identifies a device, so if it was last used by someone else
 * (a shared PC) it moves to whoever is signed in now.
 */
export async function registerDeviceToken(token: string, userAgent: string) {
  const user = await requireUser();
  if (typeof token !== "string" || token.length < 20 || token.length > 4096) return { ok: false };
  await db.deviceToken.upsert({
    where: { token },
    update: { userId: user.id, isDelete: 0, lastSeenAt: new Date(), userAgent: String(userAgent ?? "").slice(0, 300) },
    create: { token, userId: user.id, userAgent: String(userAgent ?? "").slice(0, 300) },
  });
  // Keep only the newest devices per user.
  const keep = await db.deviceToken.findMany({ where: { userId: user.id }, orderBy: { lastSeenAt: "desc" }, take: MAX_TOKENS_PER_USER, select: { id: true } });
  await db.deviceToken.updateMany({ where: { userId: user.id, id: { notIn: keep.map((k) => k.id) } }, data: { isDelete: 1 } });
  return { ok: true };
}
