import "server-only";
import { db, type Tx } from "@/server/db";
import { FieldError } from "@/server/prisma-errors";
import { logActivity } from "@/server/security/activity";
import { dayValue, istDate, istDay, todayIst } from "./daybook-dates";

// Daily close lock. A branch must reconcile and close its Daybook for every day it moved cash. Until the previous day is
// closed, nothing financial (payments, receipts, sales, expenses, deposits, transfers, manual journals, reversals) can be
// posted for that branch. The check sits in postJournal, which every money posting goes through inside its own transaction,
// so a locked branch rolls back the whole business record, whichever screen or API started it.

/** Cash in Hand (ACCT.CASH in ledger.ts, which imports this file and so can't be imported back). */
const CASH_CODE = "1000";

/** Postings that are bookkeeping, not money moving, or that are part of closing itself: never locked. */
const EXEMPT_SOURCES = new Set(["CASH_VARIANCE", "OPENING_BALANCE", "BANK_RECLASS", "COGS", "CASE_INVOICE", "PURCHASE_BILL"]);

/** Thrown when a branch's earlier day is unreconciled. A FieldError, so every action shows it as a form message. */
export class DayLockError extends FieldError {
  constructor(message: string) {
    super("form", message);
  }
}

type Client = Tx | typeof db;

/** The earliest business day before `date` that had cash movement but was never closed, if any. */
export async function earliestUnclosedDay(client: Client, branchId: string, date: string): Promise<string | null> {
  const { from } = istDay(date);
  const lastClose = await client.dayClose.findFirst({ where: { branchId, date: { lt: dayValue(date) } }, orderBy: { date: "desc" }, select: { date: true } });
  const after = lastClose ? istDay(lastClose.date.toISOString().slice(0, 10)).to : undefined;
  const line = await client.journalLine.findFirst({
    where: {
      account: { code: CASH_CODE },
      branchId,
      entry: { sourceType: { not: "OPENING_BALANCE" }, entryDate: { lt: from, ...(after ? { gte: after } : {}) } },
    },
    orderBy: { entry: { entryDate: "asc" } },
    select: { entry: { select: { entryDate: true } } },
  });
  return line ? istDate(line.entry.entryDate) : null;
}

/** The branch's unexpired, unrevoked exception to the lock, if there is one. */
export function activeOverride(client: Client, branchId: string) {
  return client.daybookOverride.findFirst({
    where: { branchId, revokedAt: null, isDelete: 0, expiresAt: { gt: new Date() } },
    orderBy: { expiresAt: "desc" },
    select: { id: true, reason: true, expiresAt: true, grantedBy: { select: { firstName: true, lastName: true } } },
  });
}

/** Where the branch stands today: the day it still owes a close for, and any override that lets it carry on. */
export async function getDayLock(client: Client, branchId: string) {
  const [unclosedDay, override] = await Promise.all([earliestUnclosedDay(client, branchId, todayIst()), activeOverride(client, branchId)]);
  return { unclosedDay, override, locked: unclosedDay !== null && !override };
}

/**
 * Called by postJournal before it writes anything. Throws DayLockError when `branchId` still owes a close, unless an
 * authorised override is active, in which case the posting goes ahead and the use is written to the activity log.
 */
export async function assertDaybookCurrent(tx: Tx, branchId: string, sourceType: string, narration: string) {
  if (EXEMPT_SOURCES.has(sourceType)) return;
  const unclosed = await earliestUnclosedDay(tx, branchId, todayIst());
  if (!unclosed) return;
  const override = await activeOverride(tx, branchId);
  if (override) {
    await logActivity({ action: "finance.daybook.override.used", entity: "Branch", entityId: branchId, detail: `${sourceType} posted while ${unclosed} is unclosed (override ${override.id}: ${override.reason}) — ${narration}` });
    return;
  }
  const branch = await tx.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  throw new DayLockError(
    `${branch?.name ?? "This branch"}'s Daybook for ${unclosed} is not reconciled and closed. Close it in Finance → Daybook before posting payments, receipts, expenses or transfers, or ask a Finance approver for an override.`,
  );
}

/** Branches that owe a close today, for the Head Office overview. */
export async function lockedBranches() {
  const branches = await db.branch.findMany({ where: { isActive: true, isDelete: 0 }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } });
  const today = todayIst();
  const found = await Promise.all(
    branches.map(async (b) => ({ ...b, unclosedDay: await earliestUnclosedDay(db, b.id, today), override: await activeOverride(db, b.id) })),
  );
  return found.filter((b) => b.unclosedDay !== null);
}
