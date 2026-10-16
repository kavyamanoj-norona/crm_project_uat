import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Case invoices (the final bills), newest first. Tabs by payment status. */
export async function listInvoicesPage(list: ListState, branchId: string | null) {
  const status = ["UNPAID", "PARTIAL", "PAID"].includes(list.tab) ? (list.tab as "UNPAID" | "PARTIAL" | "PAID") : null;
  const base: Prisma.CaseInvoiceWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(list.q ? { OR: [{ invoiceNo: ci(list.q) }, { customer: { name: ci(list.q) } }, { case: { jobsheetNo: ci(list.q) } }] } : {}),
  };
  const where = { ...base, ...(status ? { paymentStatus: status } : {}) };
  const [rows, total, groups] = await Promise.all([
    db.caseInvoice.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      ...pageArgs(list),
      include: {
        customer: { select: { name: true } },
        case: { select: { id: true, jobsheetNo: true } },
        branch: { select: { code: true } },
        lines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    db.caseInvoice.count({ where }),
    db.caseInvoice.groupBy({ by: ["paymentStatus"], where: base, _count: { _all: true } }),
  ]);
  const n = (s: string) => groups.find((g) => g.paymentStatus === s)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
    { key: "UNPAID", label: "Unpaid", count: n("UNPAID") },
    { key: "PARTIAL", label: "Part paid", count: n("PARTIAL") },
    { key: "PAID", label: "Paid", count: n("PAID") },
  ];
  return { rows, total, tabs };
}

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"] as const;

/** Customer payments (receipts): advances, payments at closing and later dues. */
export async function listReceiptsPage(list: ListState, branchId: string | null) {
  const mode = (MODES as readonly string[]).includes(list.tab) ? (list.tab as (typeof MODES)[number]) : null;
  const base: Prisma.PaymentWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(list.q ? { OR: [{ customer: { name: ci(list.q) } }, { case: { jobsheetNo: ci(list.q) } }, { reference: ci(list.q) }, { invoice: { invoiceNo: ci(list.q) } }] } : {}),
  };
  const where = { ...base, ...(mode ? { mode } : {}) };
  const [rows, total, groups] = await Promise.all([
    db.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      ...pageArgs(list),
      include: { customer: { select: { name: true } }, case: { select: { id: true, jobsheetNo: true } }, invoice: { select: { invoiceNo: true } }, branch: { select: { code: true } } },
    }),
    db.payment.count({ where }),
    db.payment.groupBy({ by: ["mode"], where: base, _count: { _all: true } }),
  ]);
  const n = (m: string) => groups.find((g) => g.mode === m)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
    { key: "CASH", label: "Cash", count: n("CASH") },
    { key: "UPI", label: "UPI", count: n("UPI") },
    { key: "CARD", label: "Card", count: n("CARD") },
    { key: "BANK_TRANSFER", label: "Bank transfer", count: n("BANK_TRANSFER") },
  ];
  return { rows, total, tabs };
}

/** Journal entries with their totals, newest first; tabs by what produced them. */
export async function listJournalPage(list: ListState, branchId: string | null, sourceTypes?: string[]) {
  const SOURCES = ["CASE_INVOICE", "CASE_PAYMENT", "PURCHASE_BILL", "PURCHASE_PAYMENT", "DIRECT_SALE", "EXPENSE", "TRANSFER", "CREDIT_NOTE", "COGS", "MANUAL", "REVERSAL"];
  const tab = SOURCES.includes(list.tab) ? list.tab : "";
  const base: Prisma.JournalEntryWhereInput = {
    ...(sourceTypes ? { sourceType: { in: sourceTypes } } : {}),
    ...(branchId ? { lines: { some: { branchId } } } : {}),
    ...(list.q ? { OR: [{ entryNo: ci(list.q) }, { narration: ci(list.q) }] } : {}),
  };
  const where = { ...base, ...(tab ? { sourceType: tab } : {}) };
  const [rows, total, groups] = await Promise.all([
    db.journalEntry.findMany({
      where,
      orderBy: [{ entryDate: "desc" }, { entryNo: "desc" }],
      ...pageArgs(list),
      include: { lines: { include: { account: { select: { code: true, name: true } }, branch: { select: { code: true } } } } },
    }),
    db.journalEntry.count({ where }),
    sourceTypes ? Promise.resolve([]) : db.journalEntry.groupBy({ by: ["sourceType"], where: base, _count: { _all: true } }),
  ]);
  const labels: Record<string, string> = { CASE_INVOICE: "Invoices", CASE_PAYMENT: "Receipts", PURCHASE_BILL: "Purchases", PURCHASE_PAYMENT: "Supplier payments", DIRECT_SALE: "Sales", EXPENSE: "Expenses", TRANSFER: "Transfers", CREDIT_NOTE: "Credit notes", COGS: "Cost of goods", MANUAL: "Manual", REVERSAL: "Reversals" };
  const tabs: FilterTab[] = sourceTypes
    ? []
    : [
        { key: "", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
        ...groups.filter((g) => labels[g.sourceType]).map((g) => ({ key: g.sourceType, label: labels[g.sourceType]!, count: g._count._all })),
      ];
  const reversed = new Set((await db.journalEntry.findMany({ where: { sourceType: "REVERSAL", sourceId: { in: rows.map((r) => r.id) } }, select: { sourceId: true } })).map((r) => r.sourceId));
  return { rows, total, tabs, reversed };
}
