import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ACCT } from "./ledger";

// Report queries over the journal. Branch filter: one branch, or null for the consolidated Head Office view.

export type Range = { from: Date; to: Date; fromStr: string; toStr: string };

const istDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);

/** from / to (yyyy-mm-dd) from the URL; defaults to the start of the month until today. */
export function parseRange(sp: Record<string, string | string[] | undefined>, defaultFrom?: string): Range {
  const get = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const valid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  const today = istDate(new Date());
  const fromStr = valid(get("from")) ? get("from") : (defaultFrom ?? `${today.slice(0, 8)}01`);
  const toStr = valid(get("to")) ? get("to") : today;
  return { fromStr, toStr, from: new Date(`${fromStr}T00:00:00+05:30`), to: new Date(new Date(`${toStr}T00:00:00+05:30`).getTime() + 86_400_000) };
}

const lineWhere = (branchId: string | null, range?: { from?: Date; to?: Date }): Prisma.JournalLineWhereInput => ({
  ...(branchId ? { branchId } : {}),
  ...(range?.from || range?.to ? { entry: { entryDate: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: range.to } : {}) } } } : {}),
});

export type AccountTotals = { id: string; code: string; name: string; type: string; subType: string | null; debit: number; credit: number };

/** Debit and credit totals per account (only accounts with movement unless includeEmpty). */
export async function accountTotals(branchId: string | null, range?: { from?: Date; to?: Date }, includeEmpty = false): Promise<AccountTotals[]> {
  const [accounts, sums] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true, type: true, subType: true } }),
    db.journalLine.groupBy({ by: ["accountId"], where: lineWhere(branchId, range), _sum: { debitPaise: true, creditPaise: true } }),
  ]);
  const by = new Map(sums.map((s) => [s.accountId, s._sum]));
  return accounts
    .map((a) => ({ ...a, debit: by.get(a.id)?.debitPaise ?? 0, credit: by.get(a.id)?.creditPaise ?? 0 }))
    .filter((a) => includeEmpty || a.debit !== 0 || a.credit !== 0);
}

/** Natural balance of an account: debit-normal for assets and expenses, credit-normal for the rest. */
export const naturalBalance = (a: { type: string; debit: number; credit: number }) => (a.type === "ASSET" || a.type === "EXPENSE" ? a.debit - a.credit : a.credit - a.debit);

/** Profit & loss for a period: income, expenses and the profit. */
export async function profitAndLoss(branchId: string | null, range: Range) {
  const rows = await accountTotals(branchId, range);
  const income = rows.filter((r) => r.type === "INCOME").map((r) => ({ ...r, amount: naturalBalance(r) }));
  const expense = rows.filter((r) => r.type === "EXPENSE").map((r) => ({ ...r, amount: naturalBalance(r) }));
  const totalIncome = income.reduce((s, r) => s + r.amount, 0);
  const totalExpense = expense.reduce((s, r) => s + r.amount, 0);
  return { income, expense, totalIncome, totalExpense, profit: totalIncome - totalExpense };
}

/** Balance sheet as at a date: assets, liabilities, equity (owner's equity plus all profit to date). */
export async function balanceSheet(branchId: string | null, asAt: Date) {
  const rows = await accountTotals(branchId, { to: new Date(asAt.getTime() + 86_400_000) });
  const amount = (type: string) => rows.filter((r) => r.type === type).map((r) => ({ ...r, amount: naturalBalance(r) }));
  const assets = amount("ASSET");
  const liabilities = amount("LIABILITY");
  const equity = amount("EQUITY");
  const income = rows.filter((r) => r.type === "INCOME").reduce((s, r) => s + naturalBalance(r), 0);
  const expense = rows.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + naturalBalance(r), 0);
  const profit = income - expense;
  const totalAssets = assets.reduce((s, r) => s + r.amount, 0);
  const totalLiabilities = liabilities.reduce((s, r) => s + r.amount, 0);
  const totalEquity = equity.reduce((s, r) => s + r.amount, 0) + profit;
  return { assets, liabilities, equity, profit, totalAssets, totalLiabilities, totalEquity, balanced: totalAssets === totalLiabilities + totalEquity };
}

/** One account's ledger for a period: opening balance, each line, running balance. */
export async function accountLedger(accountId: string, branchId: string | null, range: Range) {
  const account = await db.account.findUnique({ where: { id: accountId }, select: { id: true, code: true, name: true, type: true } });
  if (!account) return null;
  const sign = account.type === "ASSET" || account.type === "EXPENSE" ? 1 : -1;
  const [opening, lines] = await Promise.all([
    db.journalLine.aggregate({ where: { accountId, ...lineWhere(branchId, { to: range.from }) }, _sum: { debitPaise: true, creditPaise: true } }),
    db.journalLine.findMany({
      where: { accountId, ...lineWhere(branchId, range) },
      orderBy: [{ entry: { entryDate: "asc" } }, { id: "asc" }],
      take: 1000,
      include: { entry: { select: { entryNo: true, entryDate: true, narration: true, sourceType: true } }, branch: { select: { code: true } } },
    }),
  ]);
  const openingBalance = sign * ((opening._sum.debitPaise ?? 0) - (opening._sum.creditPaise ?? 0));
  let run = openingBalance;
  const rows = lines.map((l) => {
    run += sign * (l.debitPaise - l.creditPaise);
    return { ...l, balance: run };
  });
  return { account, openingBalance, rows, closingBalance: run, truncated: lines.length === 1000 };
}

/** Invoices with an unpaid balance, oldest first. */
export async function customerDues(branchId: string | null) {
  const rows = await db.caseInvoice.findMany({
    where: { ...(branchId ? { branchId } : {}), paymentStatus: { not: "PAID" } },
    orderBy: { issuedAt: "asc" },
    include: { customer: { select: { id: true, name: true } }, case: { select: { id: true, jobsheetNo: true } }, branch: { select: { code: true } } },
  });
  return rows.map((r) => ({ ...r, duePaise: r.totalPaise - r.paidPaise })).filter((r) => r.duePaise > 0);
}

/** Purchase bills with an unpaid balance, oldest first. */
export async function supplierPayables() {
  const rows = await db.purchaseBill.findMany({
    where: { paymentStatus: { not: "PAID" } },
    orderBy: { billDate: "asc" },
    include: { supplier: { select: { id: true, name: true } }, branch: { select: { code: true } } },
  });
  return rows.map((r) => ({ ...r, duePaise: r.totalPaise - r.paidPaise })).filter((r) => r.duePaise > 0);
}

/** Cash and bank balances per branch. */
export async function cashAndBank(branchId: string | null) {
  const [accounts, branches] = await Promise.all([
    db.account.findMany({ where: { code: { in: [ACCT.CASH, ACCT.BANK] } }, select: { id: true, code: true, name: true } }),
    db.branch.findMany({ where: { isActive: true, ...(branchId ? { id: branchId } : {}) }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }),
  ]);
  const sums = await db.journalLine.groupBy({ by: ["accountId", "branchId"], where: { accountId: { in: accounts.map((a) => a.id) }, ...(branchId ? { branchId } : {}) }, _sum: { debitPaise: true, creditPaise: true } });
  const cell = (accId: string, brId: string) => {
    const s = sums.find((x) => x.accountId === accId && x.branchId === brId)?._sum;
    return (s?.debitPaise ?? 0) - (s?.creditPaise ?? 0);
  };
  const cash = accounts.find((a) => a.code === ACCT.CASH)!;
  const bank = accounts.find((a) => a.code === ACCT.BANK)!;
  return branches.map((b) => ({ ...b, cash: cell(cash.id, b.id), bank: cell(bank.id, b.id) }));
}

/** Checks that the books agree with each other and with the business records. */
export async function reconcile() {
  const [totals, receivable, payable, advanceLedger, invoices, bills, payments, billPayments, sales, invoiceSum, billSum, advanceSum] = await Promise.all([
    db.journalLine.aggregate({ _sum: { debitPaise: true, creditPaise: true } }),
    accountBalanceByCode(ACCT.RECEIVABLE),
    accountBalanceByCode(ACCT.PAYABLE),
    accountBalanceByCode(ACCT.ADVANCE),
    db.caseInvoice.findMany({ select: { id: true } }),
    db.purchaseBill.findMany({ select: { id: true } }),
    db.payment.findMany({ select: { id: true } }),
    db.purchaseBillPayment.findMany({ select: { id: true } }),
    db.directSale.findMany({ select: { id: true } }),
    db.caseInvoice.aggregate({ _sum: { totalPaise: true, paidPaise: true, creditedPaise: true } }),
    db.purchaseBill.aggregate({ _sum: { totalPaise: true, paidPaise: true } }),
    db.payment.aggregate({ where: { kind: "ADVANCE" }, _sum: { amountPaise: true } }),
  ]);
  const posted = async (type: string, ids: { id: string }[]) => {
    const done = await db.journalEntry.findMany({ where: { sourceType: type, sourceId: { in: ids.map((i) => i.id) } }, select: { sourceId: true } });
    const have = new Set(done.map((d) => d.sourceId));
    return ids.filter((i) => !have.has(i.id)).length;
  };
  const [missInv, missBill, missPay, missBillPay, missSale] = await Promise.all([
    posted("CASE_INVOICE", invoices),
    posted("PURCHASE_BILL", bills),
    posted("CASE_PAYMENT", payments),
    posted("PURCHASE_PAYMENT", billPayments),
    posted("DIRECT_SALE", sales),
  ]);
  return {
    debit: totals._sum.debitPaise ?? 0,
    credit: totals._sum.creditPaise ?? 0,
    receivable,
    dueInvoices: (invoiceSum._sum.totalPaise ?? 0) - (invoiceSum._sum.creditedPaise ?? 0) - (invoiceSum._sum.paidPaise ?? 0),
    payable,
    dueBills: (billSum._sum.totalPaise ?? 0) - (billSum._sum.paidPaise ?? 0),
    advanceLedger,
    advancesTaken: advanceSum._sum.amountPaise ?? 0,
    missing: { invoices: missInv, bills: missBill, payments: missPay, billPayments: missBillPay, sales: missSale },
  };
}

async function accountBalanceByCode(code: string) {
  const acc = await db.account.findUnique({ where: { code }, select: { id: true, type: true } });
  if (!acc) return 0;
  const s = await db.journalLine.aggregate({ where: { accountId: acc.id }, _sum: { debitPaise: true, creditPaise: true } });
  const d = s._sum.debitPaise ?? 0;
  const c = s._sum.creditPaise ?? 0;
  return acc.type === "ASSET" || acc.type === "EXPENSE" ? d - c : c - d;
}
