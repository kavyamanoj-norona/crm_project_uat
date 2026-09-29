import "server-only";
import { headers } from "next/headers";
import { db } from "@/server/db";

export async function requestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    ip: forwarded || h.get("x-real-ip") || null,
    userAgent: h.get("user-agent"),
  };
}

type ActivityInput = {
  action: string;
  userId?: string | null;
  username?: string | null;
  entity?: string;
  entityId?: string;
  detail?: string;
};

/** Appends one row to the user activity log. Never throws. */
export async function logActivity(input: ActivityInput) {
  try {
    const meta = await requestMeta();
    await db.userActivityLog.create({ data: { ...input, ...meta } });
  } catch (e) {
    console.error("activity log failed", e);
  }
}

export async function isIpBlocked(ip: string | null) {
  if (!ip) return false;
  const row = await db.blockedIp.findUnique({ where: { ip } });
  return Boolean(row?.isActive);
}
