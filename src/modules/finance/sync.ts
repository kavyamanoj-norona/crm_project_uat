import "server-only";
import { db } from "@/server/db";
import { postCaseInvoice, postCasePayment, postCogs, postDirectSale, postPurchaseBill, postPurchasePayment } from "./posting";

/**
 * Posts every business record that has no journal entry yet (records created before the ledger existed, or one that failed
 * to post). Each entry is keyed by its source, so running it again, or two people running it at once, never doubles anything.
 */
export async function postMissingEntries(userId: string | null) {
  const done = { invoices: 0, bills: 0, payments: 0, billPayments: 0, sales: 0, cogs: 0 };
  const posted = async (type: string) => new Set((await db.journalEntry.findMany({ where: { sourceType: type }, select: { sourceId: true } })).map((e) => e.sourceId));

  const [hasInv, hasBill, hasPay, hasBillPay, hasSale, hasCogs] = await Promise.all([
    posted("CASE_INVOICE"), posted("PURCHASE_BILL"), posted("CASE_PAYMENT"), posted("PURCHASE_PAYMENT"), posted("DIRECT_SALE"), posted("COGS"),
  ]);

  // Payments first, so an advance is in the ledger as a liability before its invoice uses it.
  for (const p of await db.payment.findMany({ include: { case: { select: { jobsheetNo: true } } }, orderBy: { createdAt: "asc" } })) {
    if (hasPay.has(p.id)) continue;
    await db.$transaction((tx) => postCasePayment(tx, p, userId));
    done.payments++;
  }
  for (const inv of await db.caseInvoice.findMany({ include: { lines: true }, orderBy: { issuedAt: "asc" } })) {
    if (hasInv.has(inv.id)) continue;
    const advance = await db.payment.aggregate({ where: { invoiceId: inv.id, kind: "ADVANCE" }, _sum: { amountPaise: true } });
    await db.$transaction((tx) => postCaseInvoice(tx, inv, Math.min(advance._sum.amountPaise ?? 0, inv.totalPaise), userId));
    done.invoices++;
  }
  for (const b of await db.purchaseBill.findMany({ orderBy: { billDate: "asc" } })) {
    if (hasBill.has(b.id)) continue;
    await db.$transaction((tx) => postPurchaseBill(tx, b, userId));
    done.bills++;
  }
  for (const p of await db.purchaseBillPayment.findMany({ include: { bill: { select: { branchId: true, supplierId: true, billNo: true } } }, orderBy: { paidAt: "asc" } })) {
    if (hasBillPay.has(p.id)) continue;
    await db.$transaction((tx) => postPurchasePayment(tx, p, p.bill, userId));
    done.billPayments++;
  }
  for (const s of await db.directSale.findMany({ orderBy: { soldAt: "asc" } })) {
    if (hasSale.has(s.id)) continue;
    await db.$transaction((tx) => postDirectSale(tx, s, userId));
    done.sales++;
  }
  const units = await db.stockUnit.findMany({
    where: { status: "CONSUMED" },
    select: { id: true, usid: true, branchId: true, billItem: { select: { taxablePaise: true, quantity: true } }, allocatedCase: { select: { jobsheetNo: true } } },
  });
  for (const u of units) {
    if (hasCogs.has(u.id) || !u.billItem || u.billItem.quantity <= 0) continue;
    await db.$transaction((tx) => postCogs(tx, { unitId: u.id, usid: u.usid, branchId: u.branchId, costPaise: Math.round(u.billItem!.taxablePaise / u.billItem!.quantity), jobsheetNo: u.allocatedCase?.jobsheetNo }, userId));
    done.cogs++;
  }
  return done;
}
