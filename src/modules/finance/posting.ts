import "server-only";
import type { Tx } from "@/server/db";
import { ACCT, payAccount, postJournal } from "./ledger";

// How each business event becomes a journal entry. Every function is idempotent (the entry is keyed by its source), so
// calling it twice, or from a backfill, never doubles anything. Branch = where the money / goods actually are.

type PaymentRow = {
  id: string;
  branchId: string;
  customerId: string;
  kind: string;
  mode: string;
  amountPaise: number;
  invoiceId: string | null;
  createdAt: Date;
  case?: { jobsheetNo: string } | null;
};

/**
 * A customer payment. An advance (taken before the final bill) is a liability: Dr Cash/Bank, Cr Customer Advances.
 * A payment against an invoice settles the receivable: Dr Cash/Bank, Cr Accounts Receivable.
 */
export async function postCasePayment(tx: Tx, p: PaymentRow, userId?: string | null) {
  const against = p.kind === "ADVANCE" ? ACCT.ADVANCE : ACCT.RECEIVABLE;
  return postJournal(tx, {
    sourceType: "CASE_PAYMENT",
    sourceId: p.id,
    branchId: p.branchId,
    date: p.createdAt,
    userId,
    narration: `${p.kind === "ADVANCE" ? "Advance" : "Payment"} received${p.case ? ` for ${p.case.jobsheetNo}` : ""} (${p.mode})`,
    lines: [
      { account: payAccount(p.mode), branchId: p.branchId, debit: p.amountPaise },
      { account: against, branchId: p.branchId, credit: p.amountPaise, partyType: "CUSTOMER", partyId: p.customerId },
    ],
  });
}

type InvoiceForPosting = {
  id: string;
  invoiceNo: string;
  branchId: string;
  customerId: string;
  totalPaise: number;
  taxPaise: number;
  issuedAt: Date;
  lines: { type: string; taxablePaise: number }[];
};

/**
 * The final case bill. Income is recognised by type (service, spare part, accessory/product) at the taxable amount, GST goes
 * to GST Output Payable. The customer owes the total less any advance already received (that advance moves out of Customer
 * Advances); payments taken at closing are posted separately.
 */
export async function postCaseInvoice(tx: Tx, inv: InvoiceForPosting, advanceAppliedPaise: number, userId?: string | null) {
  const income = (type: string) => (type === "SERVICE" ? ACCT.SERVICE_INCOME : type === "PART" ? ACCT.PARTS_INCOME : ACCT.SALES_INCOME);
  const byAccount = new Map<string, number>();
  for (const l of inv.lines) byAccount.set(income(l.type), (byAccount.get(income(l.type)) ?? 0) + l.taxablePaise);
  return postJournal(tx, {
    sourceType: "CASE_INVOICE",
    sourceId: inv.id,
    branchId: inv.branchId,
    date: inv.issuedAt,
    userId,
    narration: `Invoice ${inv.invoiceNo}`,
    lines: [
      { account: ACCT.RECEIVABLE, branchId: inv.branchId, debit: inv.totalPaise - advanceAppliedPaise, partyType: "CUSTOMER", partyId: inv.customerId },
      { account: ACCT.ADVANCE, branchId: inv.branchId, debit: advanceAppliedPaise, partyType: "CUSTOMER", partyId: inv.customerId },
      ...[...byAccount].map(([account, credit]) => ({ account, branchId: inv.branchId, credit })),
      { account: ACCT.GST_OUTPUT, branchId: inv.branchId, credit: inv.taxPaise },
    ],
  });
}

type BillForPosting = {
  id: string;
  code: string;
  branchId: string;
  supplierId: string;
  billNo: string;
  billDate: Date;
  subtotalPaise: number;
  taxPaise: number;
  roundOffPaise: number;
  totalPaise: number;
};

/** A supplier purchase bill (Head Office): Dr Inventory + GST Input Credit, Cr Accounts Payable (the supplier). */
export async function postPurchaseBill(tx: Tx, b: BillForPosting, userId?: string | null) {
  return postJournal(tx, {
    sourceType: "PURCHASE_BILL",
    sourceId: b.id,
    branchId: b.branchId,
    date: b.billDate,
    userId,
    narration: `Purchase bill ${b.billNo} (${b.code})`,
    lines: [
      { account: ACCT.INVENTORY, branchId: b.branchId, debit: b.subtotalPaise },
      { account: ACCT.GST_INPUT, branchId: b.branchId, debit: b.taxPaise },
      { account: ACCT.ROUND_OFF, branchId: b.branchId, debit: Math.max(0, b.roundOffPaise), credit: Math.max(0, -b.roundOffPaise) },
      { account: ACCT.PAYABLE, branchId: b.branchId, credit: b.totalPaise, partyType: "SUPPLIER", partyId: b.supplierId },
    ],
  });
}

/** Paying a supplier: Dr Accounts Payable, Cr Cash/Bank. */
export async function postPurchasePayment(
  tx: Tx,
  p: { id: string; amountPaise: number; mode: string; paidAt: Date },
  bill: { branchId: string; supplierId: string; billNo: string },
  userId?: string | null,
) {
  return postJournal(tx, {
    sourceType: "PURCHASE_PAYMENT",
    sourceId: p.id,
    branchId: bill.branchId,
    date: p.paidAt,
    userId,
    narration: `Paid supplier for bill ${bill.billNo} (${p.mode})`,
    lines: [
      { account: ACCT.PAYABLE, branchId: bill.branchId, debit: p.amountPaise, partyType: "SUPPLIER", partyId: bill.supplierId },
      { account: payAccount(p.mode), branchId: bill.branchId, credit: p.amountPaise },
    ],
  });
}

/** A counter sale of a product: Dr Cash/Bank, Cr Product & Accessory Sales (the sale total as entered). */
export async function postDirectSale(
  tx: Tx,
  s: { id: string; saleNo: string; branchId: string; paymentMode: string; totalPaise: number; soldAt: Date },
  userId?: string | null,
) {
  return postJournal(tx, {
    sourceType: "DIRECT_SALE",
    sourceId: s.id,
    branchId: s.branchId,
    date: s.soldAt,
    userId,
    narration: `Direct sale ${s.saleNo} (${s.paymentMode})`,
    lines: [
      { account: payAccount(s.paymentMode), branchId: s.branchId, debit: s.totalPaise },
      { account: ACCT.SALES_INCOME, branchId: s.branchId, credit: s.totalPaise },
    ],
  });
}

/** The purchase cost of a consumed unit moves from Inventory to Cost of Goods Sold. */
export async function postCogs(tx: Tx, c: { unitId: string; usid: string; branchId: string; costPaise: number; jobsheetNo?: string | null }, userId?: string | null) {
  if (c.costPaise <= 0) return null;
  return postJournal(tx, {
    sourceType: "COGS",
    sourceId: c.unitId,
    branchId: c.branchId,
    userId,
    narration: `Cost of ${c.usid}${c.jobsheetNo ? ` used on ${c.jobsheetNo}` : ""}`,
    lines: [
      { account: ACCT.COGS, branchId: c.branchId, debit: c.costPaise },
      { account: ACCT.INVENTORY, branchId: c.branchId, credit: c.costPaise },
    ],
  });
}
