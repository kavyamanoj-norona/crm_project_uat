import "server-only";
import { db, type Tx } from "@/server/db";
import { getHeadOfficeBranch } from "@/modules/inventory/head-office";
import { ACCT, postJournal, type LedgerLine } from "./ledger";

// Cash stays in the branch's Cash in Hand. Everything else (UPI, card, bank transfer) settles into a Head Office bank
// account: the branch's books see it through the inter-branch account, the same way a cash deposit does, so each
// branch's books still balance and the bank balance is one number at Head Office.

/** Modes that can be routed to a bank account (cash never is). */
export const ROUTABLE_MODES = ["UPI", "CARD", "BANK_TRANSFER", "OTHER"] as const;
export type RoutableMode = (typeof ROUTABLE_MODES)[number];

export const MODE_LABEL: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", OTHER: "Other" };

/**
 * The bank account (code) a non-cash payment settles into: the branch's own route first, then the all-branches route,
 * then the default bank account (1010).
 */
export async function resolveBankCode(tx: Tx | typeof db, mode: string, branchId: string): Promise<string> {
  if (mode === "CASH") return ACCT.CASH;
  const routes = await tx.paymentRoute.findMany({
    where: {
      mode: mode as RoutableMode,
      isActive: true,
      isDelete: 0,
      bankAccount: { isActive: true, isDelete: 0, account: { isActive: true } },
      OR: [{ branchId }, { branchId: null }],
    },
    select: { branchId: true, bankAccount: { select: { account: { select: { code: true } } } } },
  });
  const hit = routes.find((r) => r.branchId === branchId) ?? routes.find((r) => r.branchId === null);
  return hit?.bankAccount.account.code ?? ACCT.BANK;
}

/**
 * The ledger lines for money that came in (`in`) or went out (`out`) in a payment mode at a branch. The caller adds the
 * other side (receivable, income, expense, payable …) on the same branch.
 */
export async function settlementLines(tx: Tx, o: { mode: string; branchId: string; paise: number; dir: "in" | "out" }): Promise<LedgerLine[]> {
  const inward = o.dir === "in";
  const side = (toward: boolean) => (toward === inward ? { debit: o.paise } : { credit: o.paise });
  if (o.mode === "CASH") return [{ account: ACCT.CASH, branchId: o.branchId, ...side(true) }];

  const [bank, ho] = await Promise.all([resolveBankCode(tx, o.mode, o.branchId), getHeadOfficeBranch(tx)]);
  if (ho.id === o.branchId) return [{ account: bank, branchId: o.branchId, ...side(true) }];
  const memo = `${MODE_LABEL[o.mode] ?? o.mode} ${inward ? "received" : "paid"} through the Head Office bank`;
  return [
    { account: ACCT.INTERBRANCH, branchId: o.branchId, ...side(true), memo },
    { account: bank, branchId: ho.id, ...side(true) },
    { account: ACCT.INTERBRANCH, branchId: ho.id, ...side(false), memo },
  ];
}

// ─── Earlier postings that sit on a branch's bank line ────────────────────────

const BANK_SOURCES = ["CASE_PAYMENT", "DIRECT_SALE", "PURCHASE_PAYMENT", "EXPENSE", "CREDIT_NOTE"];

/** Bank lines of those sources that were booked on a branch, not Head Office, and have not been moved yet. */
async function bankLinesAtBranches() {
  const ho = await getHeadOfficeBranch();
  const lines = await db.journalLine.findMany({
    where: { branchId: { not: ho.id }, account: { type: "ASSET", subType: "BANK" }, entry: { sourceType: { in: BANK_SOURCES } } },
    orderBy: { entry: { entryDate: "asc" } },
    select: { id: true, branchId: true, debitPaise: true, creditPaise: true, account: { select: { code: true } }, entry: { select: { entryNo: true, entryDate: true } } },
  });
  if (lines.length === 0) return { ho, pending: [] };
  const moved = await db.journalEntry.findMany({ where: { sourceType: "BANK_RECLASS", sourceId: { in: lines.map((l) => l.id) } }, select: { sourceId: true } });
  const done = new Set(moved.map((m) => m.sourceId));
  return { ho, pending: lines.filter((l) => !done.has(l.id) && l.debitPaise !== l.creditPaise) };
}

export async function countBankAtBranches() {
  return (await bankLinesAtBranches()).pending.length;
}

/**
 * Moves bank money that earlier postings left on a branch over to Head Office. One entry per original bank line, keyed
 * by that line, so running it again (or twice at once) never moves anything twice. The bank account stays the same.
 */
export async function moveBankToHeadOffice(userId: string | null) {
  const { ho, pending } = await bankLinesAtBranches();
  let moved = 0;
  for (const l of pending) {
    const net = l.debitPaise - l.creditPaise; // > 0: money came in
    const n = Math.abs(net);
    const inward = net > 0;
    const memo = `Moved to the Head Office bank (${l.entry.entryNo})`;
    const res = await db.$transaction((tx) =>
      postJournal(tx, {
        sourceType: "BANK_RECLASS",
        sourceId: l.id,
        branchId: l.branchId,
        date: l.entry.entryDate,
        userId,
        narration: `Bank ${inward ? "receipt" : "payment"} of ${l.entry.entryNo} moved to the Head Office bank`,
        lines: [
          { account: ACCT.INTERBRANCH, branchId: l.branchId, ...(inward ? { debit: n } : { credit: n }), memo },
          { account: l.account.code, branchId: l.branchId, ...(inward ? { credit: n } : { debit: n }) },
          { account: l.account.code, branchId: ho.id, ...(inward ? { debit: n } : { credit: n }) },
          { account: ACCT.INTERBRANCH, branchId: ho.id, ...(inward ? { credit: n } : { debit: n }), memo },
        ],
      }),
    );
    if (res.created) moved++;
  }
  return moved;
}

// ─── Reads for the Cash & Bank page ───────────────────────────────────────────

/** Every bank account in the chart with its details (if any) and its balance across all branches. */
export async function listBankBooks() {
  const accounts = await db.account.findMany({
    where: { type: "ASSET", subType: "BANK" },
    orderBy: { code: "asc" },
    select: { id: true, code: true, name: true, isActive: true, bankAccount: true },
  });
  const sums = await db.journalLine.groupBy({ by: ["accountId"], where: { accountId: { in: accounts.map((a) => a.id) } }, _sum: { debitPaise: true, creditPaise: true } });
  const routes = await db.paymentRoute.groupBy({ by: ["bankAccountId"], where: { isActive: true, isDelete: 0 }, _count: { _all: true } });
  return accounts.map((a) => {
    const s = sums.find((x) => x.accountId === a.id)?._sum;
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      isActive: a.isActive,
      detail: a.bankAccount,
      balancePaise: (s?.debitPaise ?? 0) - (s?.creditPaise ?? 0),
      routeCount: a.bankAccount ? (routes.find((r) => r.bankAccountId === a.bankAccount!.id)?._count._all ?? 0) : 0,
    };
  });
}

export function listPaymentRoutes() {
  return db.paymentRoute.findMany({
    where: { isActive: true, isDelete: 0 },
    orderBy: [{ mode: "asc" }, { createdAt: "asc" }],
    select: { id: true, mode: true, upiId: true, branch: { select: { code: true, name: true } }, bankAccount: { select: { bankName: true, account: { select: { code: true, name: true } } } } },
  });
}
