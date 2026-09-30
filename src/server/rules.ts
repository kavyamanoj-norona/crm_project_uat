import "server-only";
import { db } from "@/server/db";

/**
 * Business rules editable in Master Settings → Rules. Code reads them by
 * code with a fallback, so a missing or inactive rule never breaks a flow.
 */
export async function getNumberRule(code: string, fallback: number): Promise<number> {
  const rule = await db.rule.findUnique({ where: { code }, select: { value: true, isActive: true } });
  if (!rule?.isActive) return fallback;
  const n = Number(rule.value);
  return Number.isFinite(n) ? n : fallback;
}

export async function getBooleanRule(code: string, fallback: boolean): Promise<boolean> {
  const rule = await db.rule.findUnique({ where: { code }, select: { value: true, isActive: true } });
  if (!rule?.isActive) return fallback;
  return rule.value === "true";
}

export async function getTextRule(code: string, fallback: string): Promise<string> {
  const rule = await db.rule.findUnique({ where: { code }, select: { value: true, isActive: true } });
  return rule?.isActive ? rule.value : fallback;
}

/** Codes used in code. Keep in sync with prisma/seed/rules.ts. */
export const RULES = {
  loginMaxAttempts: "LOGIN_MAX_ATTEMPTS",
  loginLockMinutes: "LOGIN_LOCK_MINUTES",
  sessionHours: "SESSION_HOURS",
  discountCapPercent: "DISCOUNT_CAP_PERCENT",
  defaultGstPercent: "DEFAULT_GST_PERCENT",
} as const;
