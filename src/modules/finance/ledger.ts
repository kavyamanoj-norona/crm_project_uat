import "server-only";
import type { Tx } from "@/server/db";
import { nextSequence } from "@/server/sequence";
import { assertDaybookCurrent } from "./day-lock";

// Double-entry bookkeeping core. Every financial event becomes one balanced journal entry. Entries are never edited or
// deleted (a mistake is corrected with a reversal), and (sourceType, sourceId) is unique, so the same event can never be
// posted twice. Lines carry a branch, so branch-wise books and the consolidated Head Office books come from the same data.

/** Account codes of the chart of accounts (seeded by the migration). */
export const ACCT = {
  CASH: "1000",
  BANK: "1010",
  RECEIVABLE: "1100",
  INVENTORY: "1200",
  GST_INPUT: "1300",
  INTERBRANCH: "1400",
  PAYABLE: "2000",
  GST_OUTPUT: "2100",
  ADVANCE: "2200",
  EQUITY: "3000",
  SERVICE_INCOME: "4000",
  PARTS_INCOME: "4050",
  SALES_INCOME: "4100",
  SALES_RETURNS: "4200",
  COGS: "5000",
  OTHER_EXPENSE: "5190",
  ROUND_OFF: "5900",
} as const;

/** Cash goes to Cash in Hand; UPI, card and bank transfers go to the bank account. */
export const payAccount = (mode: string) => (mode === "CASH" ? ACCT.CASH : ACCT.BANK);

export type LedgerLine = {
  account: string; // account code
  branchId: string;
  debit?: number;
  credit?: number;
  partyType?: "CUSTOMER" | "SUPPLIER";
  partyId?: string;
  memo?: string;
};

export type JournalInput = {
  sourceType: string;
  sourceId: string | null;
  branchId?: string | null;
  narration: string;
  date?: Date;
  userId?: string | null;
  reversalOfId?: string | null;
  lines: LedgerLine[];
};

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const yymm = (d: Date) => periodFmt.formatToParts(d).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

export class LedgerError extends Error {}

/**
 * Posts one balanced entry inside the caller's transaction. Zero-value lines are dropped. Every branch's own lines must
 * balance (so branch books always balance) as well as the entry as a whole. If the same (sourceType, sourceId) was posted
 * before, nothing is created and the existing entry is returned (created: false).
 */
export async function postJournal(tx: Tx, input: JournalInput): Promise<{ id: string; entryNo: string; created: boolean }> {
  const lines = input.lines.filter((l) => (l.debit ?? 0) > 0 || (l.credit ?? 0) > 0);
  if (lines.length < 2) throw new LedgerError("A journal entry needs at least two lines.");
  const perBranch = new Map<string, number>();
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    const d = l.debit ?? 0;
    const c = l.credit ?? 0;
    if (!Number.isInteger(d) || !Number.isInteger(c) || d < 0 || c < 0 || (d > 0 && c > 0)) throw new LedgerError("Each line is either a debit or a credit, in whole paise.");
    debit += d;
    credit += c;
    perBranch.set(l.branchId, (perBranch.get(l.branchId) ?? 0) + d - c);
  }
  if (debit !== credit) throw new LedgerError(`The entry does not balance (debit ${debit} ≠ credit ${credit}).`);
  for (const [, net] of perBranch) {
    if (net !== 0) throw new LedgerError("Each branch's lines must balance on their own (use the inter-branch account to move value between branches).");
  }

  if (input.sourceId) {
    const existing = await tx.journalEntry.findFirst({ where: { sourceType: input.sourceType, sourceId: input.sourceId }, select: { id: true, entryNo: true } });
    if (existing) return { ...existing, created: false };
  }

  // Daily close lock: the branch where this happened must have closed its earlier days (or hold an override).
  await assertDaybookCurrent(tx, input.branchId ?? lines[0]!.branchId, input.sourceType, input.narration);

  const codes = [...new Set(lines.map((l) => l.account))];
  const accounts = await tx.account.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const byCode = new Map(accounts.map((a) => [a.code, a.id]));
  for (const c of codes) if (!byCode.has(c)) throw new LedgerError(`Account ${c} does not exist.`);

  const date = input.date ?? new Date();
  const seq = await nextSequence(tx, `JV:${yymm(date)}`);
  const entryNo = `JV-${yymm(date)}-${String(seq).padStart(6, "0")}`;
  const entry = await tx.journalEntry.create({
    data: {
      entryNo,
      entryDate: date,
      branchId: input.branchId ?? lines[0]!.branchId,
      narration: input.narration,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      reversalOfId: input.reversalOfId ?? null,
      createdById: input.userId ?? null,
      lines: {
        create: lines.map((l) => ({
          accountId: byCode.get(l.account)!,
          branchId: l.branchId,
          debitPaise: l.debit ?? 0,
          creditPaise: l.credit ?? 0,
          partyType: l.partyType ?? null,
          partyId: l.partyId ?? null,
          memo: l.memo ?? null,
        })),
      },
    },
    select: { id: true, entryNo: true },
  });
  return { ...entry, created: true };
}

/** Corrects a posted entry by posting its mirror image. The original stays, so the audit trail is complete. */
export async function reverseJournal(tx: Tx, entryId: string, userId: string | null, reason: string) {
  const original = await tx.journalEntry.findUniqueOrThrow({ where: { id: entryId }, include: { lines: { include: { account: { select: { code: true } } } } } });
  if (original.sourceType === "REVERSAL") throw new LedgerError("A reversal cannot be reversed.");
  const done = await tx.journalEntry.findFirst({ where: { sourceType: "REVERSAL", sourceId: entryId }, select: { entryNo: true } });
  if (done) throw new LedgerError(`Already reversed by ${done.entryNo}.`);
  return postJournal(tx, {
    sourceType: "REVERSAL",
    sourceId: entryId,
    branchId: original.branchId,
    narration: `Reversal of ${original.entryNo}: ${reason}`,
    userId,
    reversalOfId: original.id,
    lines: original.lines.map((l) => ({
      account: l.account.code,
      branchId: l.branchId,
      debit: l.creditPaise,
      credit: l.debitPaise,
      partyType: (l.partyType as "CUSTOMER" | "SUPPLIER" | null) ?? undefined,
      partyId: l.partyId ?? undefined,
      memo: l.memo ?? undefined,
    })),
  });
}
