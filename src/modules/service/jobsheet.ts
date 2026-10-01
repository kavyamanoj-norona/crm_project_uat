import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextSequence, peekSequence } from "@/server/sequence";

// Jobsheet numbers: LC-{BRANCH}-{YYMM}-{SEQ}, e.g. LC-EDP-2607-0144 (blueprint §11).
// The sequence restarts every month for every branch; YYMM is the month in IST.
// Uniqueness comes from the atomic counter (one per branch code per month) and
// is backed by the unique index on Case.jobsheetNo.

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });

/** "2607" for July 2026 (Asia/Kolkata). */
export function jobsheetPeriod(date: Date = new Date()) {
  const parts = periodFmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}${get("month")}`;
}

/** LC-EDP-2607-0144. Numbers past 9999 simply grow a digit. */
export function formatJobsheetNo(branchCode: string, period: string, seq: number) {
  return `LC-${branchCode.toUpperCase()}-${period}-${String(seq).padStart(4, "0")}`;
}

const sequenceKey = (branchCode: string, period: string) => `JOBSHEET:${branchCode.toUpperCase()}:${period}`;

/**
 * Takes the next jobsheet number for a branch. Must run inside the transaction
 * that creates the case, so a failed save doesn't burn a number.
 */
export async function nextJobsheetNo(tx: Prisma.TransactionClient, branchCode: string, date: Date = new Date()) {
  const period = jobsheetPeriod(date);
  return formatJobsheetNo(branchCode, period, await nextSequence(tx, sequenceKey(branchCode, period)));
}

/** The number the next case would get — shown on the intake form, not reserved. */
export async function peekJobsheetNo(branchCode: string, date: Date = new Date()) {
  const period = jobsheetPeriod(date);
  return formatJobsheetNo(branchCode, period, await peekSequence(sequenceKey(branchCode, period)));
}
