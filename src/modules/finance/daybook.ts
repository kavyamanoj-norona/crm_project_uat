import "server-only";
import { db } from "@/server/db";
import { ACCT } from "./ledger";

// The Daybook is the branch's cash book, read straight from the ledger: every journal line on Cash in Hand for the
// branch on that business day (IST). Case payments and counter sales post there automatically; expenses, bank deposits
// and the day-end difference are posted from the Daybook itself.

import { dayValue, isDateString, istDay, todayIst } from "./daybook-dates";
import { earliestUnclosedDay as unclosedDayBefore } from "./day-lock";

export { dayValue, isDateString, istDay, todayIst };

export type DaybookRowType = "auto" | "expense" | "deposit" | "variance" | "reversal" | "other";

const rowType = (sourceType: string): DaybookRowType =>
  sourceType === "CASE_PAYMENT" || sourceType === "DIRECT_SALE"
    ? "auto"
    : sourceType === "EXPENSE"
      ? "expense"
      : sourceType === "CASH_DEPOSIT"
        ? "deposit"
        : sourceType === "CASH_VARIANCE"
          ? "variance"
          : sourceType === "REVERSAL"
            ? "reversal"
            : "other";

async function cashAccountId() {
  const acc = await db.account.findUnique({ where: { code: ACCT.CASH }, select: { id: true } });
  if (!acc) throw new Error("The Cash in Hand account (1000) is missing from the chart of accounts.");
  return acc.id;
}

/** Cash in Hand balance of a branch for everything posted before `before`. */
export async function cashBalanceBefore(branchId: string, before: Date) {
  const accountId = await cashAccountId();
  const s = await db.journalLine.aggregate({
    where: { accountId, branchId, entry: { entryDate: { lt: before } } },
    _sum: { debitPaise: true, creditPaise: true },
  });
  return (s._sum.debitPaise ?? 0) - (s._sum.creditPaise ?? 0);
}

/** One branch's cash book from `fromDate` to `toDate` (business days, inclusive). */
export async function getDaybook(branchId: string, fromDate: string, toDate = fromDate) {
  const { from } = istDay(fromDate);
  const { to } = istDay(toDate);
  const accountId = await cashAccountId();
  const [opening, lines, closes] = await Promise.all([
    cashBalanceBefore(branchId, from),
    db.journalLine.findMany({
      where: { accountId, branchId, entry: { entryDate: { gte: from, lt: to } } },
      orderBy: [{ entry: { entryDate: "asc" } }, { entry: { entryNo: "asc" } }],
      select: {
        id: true,
        debitPaise: true,
        creditPaise: true,
        entry: {
          select: {
            entryNo: true,
            entryDate: true,
            narration: true,
            sourceType: true,
            cashbookEntry: { select: { kind: true, description: true, remarks: true, receiptUrl: true, account: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
    db.dayClose.findMany({
      where: { branchId, date: { gte: dayValue(fromDate), lte: dayValue(toDate) } },
      orderBy: { date: "asc" },
      include: { closedBy: { select: { firstName: true, lastName: true } }, varianceEntry: { select: { entryNo: true } } },
    }),
  ]);

  let balance = opening;
  const rows = lines.map((l) => {
    balance += l.debitPaise - l.creditPaise;
    const cb = l.entry.cashbookEntry;
    return {
      id: l.id,
      at: l.entry.entryDate,
      entryNo: l.entry.entryNo,
      type: rowType(l.entry.sourceType),
      description: cb ? `${cb.kind === "DEPOSIT" ? "Deposit to " : "Expense — "}${cb.kind === "DEPOSIT" ? cb.account.name : cb.description}${cb.kind === "EXPENSE" ? ` · ${cb.account.name}` : ""}` : l.entry.narration,
      remarks: cb?.remarks ?? null,
      receiptUrl: cb?.receiptUrl ?? null,
      by: cb?.createdBy ?? null,
      inPaise: l.debitPaise,
      outPaise: l.creditPaise,
      balancePaise: balance,
    };
  });

  const cashInPaise = rows.reduce((s, r) => s + r.inPaise, 0);
  const sum = (t: DaybookRowType) => rows.filter((r) => r.type === t).reduce((s, r) => s + r.outPaise - r.inPaise, 0);
  return {
    openingPaise: opening,
    rows,
    cashInPaise: rows.filter((r) => r.type !== "expense" && r.type !== "deposit").reduce((s, r) => s + r.inPaise, 0),
    expensesPaise: sum("expense"),
    expenseCount: rows.filter((r) => r.type === "expense").length,
    depositsPaise: sum("deposit"),
    totalInPaise: cashInPaise,
    totalOutPaise: rows.reduce((s, r) => s + r.outPaise, 0),
    balancePaise: balance,
    /** The day's close; only for a single-day book. */
    close: fromDate === toDate ? (closes[0] ?? null) : null,
    closedDays: closes.length,
  };
}

export type LedgerAccount = "cash" | "bank";

const MODE_NAMES: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", OTHER: "Other" };

/** Payment mode of a posting: payments and sales carry it in the narration "(UPI)"; the rest are plain cash or bank. */
function entryMode(account: LedgerAccount, sourceType: string, narration: string) {
  if (account === "cash") return "Cash";
  if (sourceType === "CASE_PAYMENT" || sourceType === "DIRECT_SALE") {
    const m = /\(([A-Z_]+)\)\s*$/.exec(narration)?.[1];
    if (m && MODE_NAMES[m]) return MODE_NAMES[m];
  }
  return "Bank";
}

/**
 * Consolidated Head Office book: every money-in / money-out line on the cash boxes (`account: "cash"`) or on the Head
 * Office bank accounts (`"bank"`), from `fromDate` to `toDate`, optionally for one branch (`branchId`), with a running
 * balance. The two ledgers are never mixed, so a cash deposit shows once as cash out and once as bank in, and UPI / card
 * collections (which settle to the bank, not the cash box) appear only in the bank ledger. A bank line is attributed to
 * the branch where the event happened (the journal entry's branch), since the bank itself is held at Head Office.
 */
export async function getLedgerBook(o: { account: LedgerAccount; branchId: string | null; fromDate: string; toDate: string }) {
  const { from } = istDay(o.fromDate);
  const { to } = istDay(o.toDate);
  const accountIds =
    o.account === "cash"
      ? [await cashAccountId()]
      : (await db.account.findMany({ where: { type: "ASSET", subType: "BANK", isDelete: 0 }, select: { id: true } })).map((a) => a.id);
  const b = o.branchId;
  const branchWhere =
    b === null ? {} : o.account === "cash" ? { branchId: b } : { OR: [{ entry: { branchId: b } }, { entry: { branchId: null }, branchId: b }] };
  const base = { accountId: { in: accountIds }, isDelete: 0, ...branchWhere };

  const [open, lines, branches] = await Promise.all([
    db.journalLine.aggregate({ where: { ...base, entry: { entryDate: { lt: from } } }, _sum: { debitPaise: true, creditPaise: true } }),
    db.journalLine.findMany({
      where: { ...base, entry: { entryDate: { gte: from, lt: to } } },
      orderBy: [{ entry: { entryDate: "asc" } }, { entry: { entryNo: "asc" } }],
      select: {
        id: true,
        debitPaise: true,
        creditPaise: true,
        branch: { select: { code: true, name: true } },
        entry: {
          select: {
            entryNo: true,
            entryDate: true,
            narration: true,
            sourceType: true,
            branchId: true,
            cashbookEntry: { select: { kind: true, description: true, remarks: true, receiptUrl: true, account: { select: { name: true } }, createdBy: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    }),
    db.branch.findMany({ select: { id: true, code: true, name: true } }),
  ]);
  const branchById = new Map(branches.map((x) => [x.id, x]));
  const openingPaise = (open._sum.debitPaise ?? 0) - (open._sum.creditPaise ?? 0);

  let balance = openingPaise;
  const rows = lines.map((l) => {
    balance += l.debitPaise - l.creditPaise;
    const cb = l.entry.cashbookEntry;
    const src = (l.entry.branchId ? branchById.get(l.entry.branchId) : undefined) ?? l.branch;
    return {
      id: l.id,
      at: l.entry.entryDate,
      entryNo: l.entry.entryNo,
      type: rowType(l.entry.sourceType),
      branchCode: src.code,
      branchName: src.name,
      mode: entryMode(o.account, l.entry.sourceType, l.entry.narration),
      description: cb ? `${cb.kind === "DEPOSIT" ? "Deposit to " : "Expense — "}${cb.kind === "DEPOSIT" ? cb.account.name : cb.description}${cb.kind === "EXPENSE" ? ` · ${cb.account.name}` : ""}` : l.entry.narration,
      remarks: cb?.remarks ?? null,
      receiptUrl: cb?.receiptUrl ?? null,
      by: cb?.createdBy ?? null,
      inPaise: l.debitPaise,
      outPaise: l.creditPaise,
      balancePaise: balance,
    };
  });
  return {
    openingPaise,
    rows,
    totalInPaise: rows.reduce((s, r) => s + r.inPaise, 0),
    totalOutPaise: rows.reduce((s, r) => s + r.outPaise, 0),
    closingPaise: balance,
  };
}

/** Number of business days from `fromDate` to `toDate`, inclusive. */
export const dayCount = (fromDate: string, toDate: string) => Math.round((dayValue(toDate).getTime() - dayValue(fromDate).getTime()) / 86_400_000) + 1;

export const COLLECTION_MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export type CollectionMode = (typeof COLLECTION_MODES)[number];
type ByMode = Record<CollectionMode, number>;
const noModes = (): ByMode => ({ CASH: 0, UPI: 0, CARD: 0, BANK_TRANSFER: 0, OTHER: 0 });

/**
 * Money collected (case payments + counter sales) in every payment mode, per branch, from `fromDate` to `toDate`.
 * `branchId` null = all branches.
 */
export async function getCollections(branchId: string | null, fromDate: string, toDate: string) {
  const { from } = istDay(fromDate);
  const { to } = istDay(toDate);
  const branch = branchId ? { branchId } : {};
  const [payments, sales] = await Promise.all([
    db.payment.groupBy({ by: ["branchId", "mode"], where: { ...branch, isDelete: 0, createdAt: { gte: from, lt: to } }, _sum: { amountPaise: true } }),
    db.directSale.groupBy({
      by: ["branchId", "paymentMode"],
      where: { ...branch, isActive: true, isDelete: 0, soldAt: { gte: from, lt: to } },
      _sum: { totalPaise: true },
    }),
  ]);
  const byBranch = new Map<string, ByMode>();
  const total = noModes();
  const add = (b: string, mode: CollectionMode, paise: number) => {
    const m = byBranch.get(b) ?? noModes();
    m[mode] += paise;
    total[mode] += paise;
    byBranch.set(b, m);
  };
  for (const p of payments) add(p.branchId, p.mode, p._sum.amountPaise ?? 0);
  for (const s of sales) add(s.branchId, s.paymentMode, s._sum.totalPaise ?? 0);
  const sum = (m: ByMode) => COLLECTION_MODES.reduce((s, k) => s + m[k], 0);
  return { byBranch: (b: string) => byBranch.get(b) ?? noModes(), total, totalPaise: sum(total), sum };
}

/** Every branch's cash book in one row each, plus collections in all modes, from `fromDate` to `toDate`. */
export async function getDaybookSummary(fromDate: string, toDate: string) {
  const { from } = istDay(fromDate);
  const { to } = istDay(toDate);
  const accountId = await cashAccountId();
  const [branches, openings, lines, closes, collections] = await Promise.all([
    db.branch.findMany({ where: { isActive: true, isDelete: 0 }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } }),
    db.journalLine.groupBy({ by: ["branchId"], where: { accountId, entry: { entryDate: { lt: from } } }, _sum: { debitPaise: true, creditPaise: true } }),
    db.journalLine.findMany({
      where: { accountId, entry: { entryDate: { gte: from, lt: to } } },
      select: { branchId: true, debitPaise: true, creditPaise: true, entry: { select: { sourceType: true } } },
    }),
    db.dayClose.groupBy({
      by: ["branchId"],
      where: { date: { gte: dayValue(fromDate), lte: dayValue(toDate) } },
      _count: { _all: true },
      _sum: { variancePaise: true },
    }),
    getCollections(null, fromDate, toDate),
  ]);

  const rows = branches.map((b) => {
    const o = openings.find((x) => x.branchId === b.id);
    const openingPaise = (o?._sum.debitPaise ?? 0) - (o?._sum.creditPaise ?? 0);
    let cashInPaise = 0;
    let expensesPaise = 0;
    let depositsPaise = 0;
    let otherOutPaise = 0;
    for (const l of lines) {
      if (l.branchId !== b.id) continue;
      const t = rowType(l.entry.sourceType);
      if (t === "expense") expensesPaise += l.creditPaise - l.debitPaise;
      else if (t === "deposit") depositsPaise += l.creditPaise - l.debitPaise;
      else {
        cashInPaise += l.debitPaise;
        otherOutPaise += l.creditPaise;
      }
    }
    const c = closes.find((x) => x.branchId === b.id);
    const modes = collections.byBranch(b.id);
    return {
      ...b,
      openingPaise,
      cashInPaise,
      expensesPaise,
      depositsPaise,
      otherOutPaise,
      closingPaise: openingPaise + cashInPaise - expensesPaise - depositsPaise - otherOutPaise,
      closedDays: c?._count._all ?? 0,
      variancePaise: c?._sum.variancePaise ?? 0,
      modes,
      collectedPaise: collections.sum(modes),
    };
  });

  const total = (k: "openingPaise" | "cashInPaise" | "expensesPaise" | "depositsPaise" | "otherOutPaise" | "closingPaise" | "variancePaise") =>
    rows.reduce((s, r) => s + r[k], 0);
  return {
    rows,
    openingPaise: total("openingPaise"),
    cashInPaise: total("cashInPaise"),
    expensesPaise: total("expensesPaise"),
    depositsPaise: total("depositsPaise"),
    otherOutPaise: total("otherOutPaise"),
    closingPaise: total("closingPaise"),
    variancePaise: total("variancePaise"),
    modes: collections.total,
    collectedPaise: collections.totalPaise,
  };
}

/** The earliest business day before `date` that had cash movement but was never closed, if any. */
export const earliestUnclosedDay = (branchId: string, date: string) => unclosedDayBefore(db, branchId, date);

/** Expense categories offered in the Daybook (the chart's expense accounts, without the system ones). */
export function listExpenseAccounts() {
  return db.account.findMany({ where: { type: "EXPENSE", subType: "EXPENSE", isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
}

/** Head Office bank accounts a branch can deposit its cash into. */
export function listBankAccounts() {
  return db.account.findMany({ where: { type: "ASSET", subType: "BANK", isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
}

/**
 * Manual postings (Finance expenses, transfers, journal entries) may not change the cash of a day that is already
 * reconciled and closed: corrections to a closed day go in as a reversal or adjustment on an open day.
 */
export async function closedCashDay(lines: { account: string; branchId: string }[], at: Date): Promise<string | null> {
  const branches = [...new Set(lines.filter((l) => l.account === ACCT.CASH).map((l) => l.branchId))];
  if (branches.length === 0) return null;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);
  const closed = await db.dayClose.findFirst({ where: { branchId: { in: branches }, date: dayValue(date) }, select: { branch: { select: { code: true } } } });
  return closed ? `${closed.branch.code}'s cash book for ${date} is already reconciled and closed. Post the correction on an open day.` : null;
}
