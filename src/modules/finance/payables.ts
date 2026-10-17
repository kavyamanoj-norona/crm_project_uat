import "server-only";
import { db } from "@/server/db";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { ACCT } from "./ledger";

// Everyone we owe money to, one row each: suppliers (purchase bills) and chip-lab vendors (outsourced repairs).

export const PAYEE_SORTS = ["name", "totalPaise", "paidPaise", "duePaise", "lastDate"] as const;
export type PayeeSort = (typeof PAYEE_SORTS)[number];

export type PayeeType = "SUPPLIER" | "VENDOR";
export type PayeeStatus = "PAID" | "PARTIAL" | "DUE";

export type Payee = {
  key: string;
  id: string;
  type: PayeeType;
  name: string;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  lastDate: Date | null;
  status: PayeeStatus;
};

export const PAYEE_STATUS_LABEL: Record<PayeeStatus, string> = { PAID: "Paid", PARTIAL: "Partial", DUE: "Due" };

const statusOf = (total: number, paid: number): PayeeStatus => (paid >= total ? "PAID" : paid <= 0 ? "DUE" : "PARTIAL");

const make = (type: PayeeType, id: string, name: string, total: number, paid: number, lastDate: Date | null): Payee => ({
  key: `${type}:${id}`,
  id,
  type,
  name,
  totalPaise: total,
  paidPaise: paid,
  duePaise: Math.max(0, total - paid),
  lastDate,
  status: statusOf(total, paid),
});

/** What a vendor is owed for a case: the vendor cost of its live items (cost × quantity). */
const caseOwed = (items: { quantity: number; vendorCostPaise: number | null }[]) => items.reduce((s, i) => s + (i.vendorCostPaise ?? 0) * i.quantity, 0);

/** Suppliers with at least one bill, and vendors with at least one outsourced case. */
export async function listPayees(): Promise<{ payees: Payee[]; supplierCount: number; vendorCount: number }> {
  const [suppliers, bills, vendors, cases, outsourced, supplierCount, vendorCount] = await Promise.all([
    db.supplier.findMany({ where: { isDelete: 0 }, select: { id: true, name: true } }),
    db.purchaseBill.groupBy({ by: ["supplierId"], where: { isDelete: 0 }, _sum: { totalPaise: true, paidPaise: true }, _max: { billDate: true } }),
    db.chipLabVendor.findMany({ where: { isDelete: 0 }, select: { id: true, name: true } }),
    db.case.findMany({
      where: { labVendorId: { not: null } },
      select: { labVendorId: true, items: { where: { removedAt: null }, select: { quantity: true, vendorCostPaise: true } }, labVendorPayments: { where: { isDelete: 0 }, select: { amountPaise: true } } },
    }),
    db.chipLabOutsource.groupBy({ by: ["vendorId"], where: { isDelete: 0 }, _max: { sentAt: true } }),
    db.supplier.count({ where: { isDelete: 0 } }),
    db.chipLabVendor.count({ where: { isDelete: 0, isActive: true } }),
  ]);

  const payees: Payee[] = [];
  for (const b of bills) {
    const s = suppliers.find((x) => x.id === b.supplierId);
    if (s) payees.push(make("SUPPLIER", s.id, s.name, b._sum.totalPaise ?? 0, b._sum.paidPaise ?? 0, b._max.billDate));
  }
  for (const v of vendors) {
    const mine = cases.filter((c) => c.labVendorId === v.id);
    if (mine.length === 0) continue;
    const total = mine.reduce((s, c) => s + caseOwed(c.items), 0);
    const paid = mine.reduce((s, c) => s + c.labVendorPayments.reduce((x, p) => x + p.amountPaise, 0), 0);
    payees.push(make("VENDOR", v.id, v.name, total, paid, outsourced.find((o) => o.vendorId === v.id)?._max.sentAt ?? null));
  }
  return { payees, supplierCount, vendorCount };
}

/** Filters, sorts and pages the combined list (it is small: one row per supplier / vendor). */
export function filterPayees(all: Payee[], o: { type?: PayeeType; status?: PayeeStatus; q: string; sort: PayeeSort; dir: "asc" | "desc" }) {
  const q = o.q.toLowerCase();
  const rows = all
    .filter((p) => (!o.type || p.type === o.type) && (!o.status || p.status === o.status) && (!q || p.name.toLowerCase().includes(q)))
    .sort((a, b) => {
      const av = o.sort === "name" ? a.name.toLowerCase() : o.sort === "lastDate" ? (a.lastDate?.getTime() ?? 0) : a[o.sort];
      const bv = o.sort === "name" ? b.name.toLowerCase() : o.sort === "lastDate" ? (b.lastDate?.getTime() ?? 0) : b[o.sort];
      const c = av < bv ? -1 : av > bv ? 1 : a.name.localeCompare(b.name);
      return o.dir === "asc" ? c : -c;
    });
  return rows;
}

// ─── Detail page: one supplier or vendor ──────────────────────────────────────

/** A bill falls due this many days after its bill date; a supplier's own payment terms replace this when specified. */
export const PAYMENT_TERM_DAYS = 30;

export type BillStatus = "PAID" | "PARTIAL" | "OVERDUE" | "DUE";

export type WorkBill = {
  id: string;
  number: string;
  branch: string | null;
  /** yyyy-mm-dd */
  date: string;
  dueDate: string;
  totalPaise: number;
  paidPaise: number;
  duePaise: number;
  status: BillStatus;
  href: string;
};
export type WorkPayment = { id: string; date: string; against: string; mode: string | null; reference: string | null; amountPaise: number };
export type WorkLedgerRow = { id: string; date: string; entryNo: string; narration: string; debitPaise: number; creditPaise: number; balancePaise: number };
export type WorkDocument = { id: string; name: string; kind: "Bill image" | "Uploaded"; date: string; url: string };
export type WorkSummary = { totalPaise: number; paidPaise: number; duePaise: number; overduePaise: number; overdueCount: number; count: number };

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const istYmd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(d);
const addDays = (iso: string, n: number) => ymd(new Date(new Date(`${iso}T00:00:00Z`).getTime() + n * 86_400_000));

function shape(rows: { id: string; number: string; branch: string | null; date: string; totalPaise: number; paidPaise: number; href: string }[], termDays: number) {
  const today = istYmd(new Date());
  const bills: WorkBill[] = rows.map((r) => {
    const duePaise = Math.max(0, r.totalPaise - r.paidPaise);
    const dueDate = addDays(r.date, termDays);
    const status: BillStatus = duePaise === 0 ? "PAID" : dueDate < today ? "OVERDUE" : r.paidPaise > 0 ? "PARTIAL" : "DUE";
    return { ...r, dueDate, duePaise, status };
  });
  const overdue = bills.filter((b) => b.status === "OVERDUE");
  const summary: WorkSummary = {
    totalPaise: bills.reduce((s, b) => s + b.totalPaise, 0),
    paidPaise: bills.reduce((s, b) => s + b.paidPaise, 0),
    duePaise: bills.reduce((s, b) => s + b.duePaise, 0),
    overduePaise: overdue.reduce((s, b) => s + b.duePaise, 0),
    overdueCount: overdue.length,
    count: bills.length,
  };
  return { bills, summary };
}

/** Everything the supplier detail page shows: contact, bills, payments, the supplier ledger and the bill images. */
export async function supplierWorkspace(supplierId: string) {
  const supplier = await db.supplier.findFirst({ where: { id: supplierId, isDelete: 0 }, select: { id: true, name: true, gstin: true, state: true, phone: true, email: true, address: true, paymentTermDays: true } });
  if (!supplier) return null;
  const [rawBills, rawPayments, rawLedger, rawDocs] = await Promise.all([
    db.purchaseBill.findMany({
      where: { supplierId, isDelete: 0 },
      orderBy: { billDate: "desc" },
      select: { id: true, billNo: true, billDate: true, totalPaise: true, paidPaise: true, imageUrl: true, branch: { select: { code: true } } },
    }),
    db.purchaseBillPayment.findMany({
      where: { isDelete: 0, bill: { supplierId, isDelete: 0 } },
      orderBy: { paidAt: "desc" },
      select: { id: true, paidAt: true, mode: true, referenceNo: true, amountPaise: true, bill: { select: { billNo: true } } },
    }),
    db.journalLine.findMany({
      where: { partyType: "SUPPLIER", partyId: supplierId, account: { code: ACCT.PAYABLE } },
      orderBy: [{ entry: { entryDate: "asc" } }, { entry: { entryNo: "asc" } }],
      select: { id: true, debitPaise: true, creditPaise: true, entry: { select: { entryNo: true, entryDate: true, narration: true } } },
    }),
    db.supplierDocument.findMany({ where: { supplierId, isDelete: 0 }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, url: true, createdAt: true } }),
  ]);
  const { bills, summary } = shape(
    rawBills.map((b) => ({ id: b.id, number: b.billNo, branch: b.branch.code, date: ymd(b.billDate), totalPaise: b.totalPaise, paidPaise: b.paidPaise, href: `${INVENTORY_PATHS.billing}/${b.id}` })),
    supplier.paymentTermDays ?? PAYMENT_TERM_DAYS,
  );
  let balance = 0;
  const ledger: WorkLedgerRow[] = rawLedger.map((l) => {
    balance += l.creditPaise - l.debitPaise; // what we owe goes up on a bill, down on a payment
    return { id: l.id, date: istYmd(l.entry.entryDate), entryNo: l.entry.entryNo, narration: l.entry.narration, debitPaise: l.debitPaise, creditPaise: l.creditPaise, balancePaise: balance };
  });
  const payments: WorkPayment[] = rawPayments.map((p) => ({ id: p.id, date: istYmd(p.paidAt), against: p.bill.billNo, mode: p.mode, reference: p.referenceNo, amountPaise: p.amountPaise }));
  const documents: WorkDocument[] = [
    ...rawDocs.map((d) => ({ id: d.id, name: d.title, kind: "Uploaded" as const, date: istYmd(d.createdAt), url: d.url })),
    ...rawBills.filter((b) => b.imageUrl).map((b) => ({ id: b.id, name: `Bill ${b.billNo}`, kind: "Bill image" as const, date: ymd(b.billDate), url: b.imageUrl! })),
  ];
  return { supplier, bills, payments, ledger, documents, summary };
}

/** The vendor detail page: contact, outsourced cases (the "bills"), and the payments made on them. */
export async function vendorWorkspace(vendorId: string) {
  const vendor = await db.chipLabVendor.findFirst({ where: { id: vendorId, isDelete: 0 }, select: { id: true, name: true, contactName: true, phone: true, email: true, address: true, isActive: true, remarks: true } });
  if (!vendor) return null;
  const cases = await db.case.findMany({
    where: { labVendorId: vendorId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      jobsheetNo: true,
      createdAt: true,
      branch: { select: { code: true } },
      items: { where: { removedAt: null }, select: { quantity: true, vendorCostPaise: true } },
      labVendorPayments: { where: { isDelete: 0 }, orderBy: { paidAt: "desc" }, select: { id: true, amountPaise: true, note: true, paidAt: true } },
    },
  });
  const { bills, summary } = shape(
    cases.map((c) => ({
      id: c.id,
      number: c.jobsheetNo,
      branch: c.branch.code,
      date: istYmd(c.createdAt),
      totalPaise: caseOwed(c.items),
      paidPaise: c.labVendorPayments.reduce((s, p) => s + p.amountPaise, 0),
      href: `${SERVICE_PATHS.lab}/${c.id}`,
    })),
    PAYMENT_TERM_DAYS,
  );
  const payments: WorkPayment[] = cases
    .flatMap((c) => c.labVendorPayments.map((p) => ({ at: p.paidAt.getTime(), row: { id: p.id, date: istYmd(p.paidAt), against: c.jobsheetNo, mode: null, reference: p.note, amountPaise: p.amountPaise } })))
    .sort((a, b) => b.at - a.at)
    .map((x) => x.row);
  return { vendor, bills, payments, summary };
}
