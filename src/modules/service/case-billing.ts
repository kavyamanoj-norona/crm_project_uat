import "server-only";
import { db } from "@/server/db";
import { getBooleanRule, RULES } from "@/server/rules";
import { minPricePaise } from "@/lib/pricing";
import { pendingParts } from "@/modules/inventory/case-parts";
import { billSummary, type BillLineInput } from "./case-billing-math";

export type ClosingLine = {
  key: string;
  itemId: string;
  code: string;
  name: string;
  type: string;
  hsnSac: string | null;
  quantity: number;
  unitPricePaise: number;
  gstPercent: number;
};

export type ClosingAccessory = { id: string; code: string; name: string; pricePaise: number; minPricePaise: number; gstPercent: number; stock: number };

/**
 * What the customer is billed for when the case closes: every service on the case, and every spare part or accessory that
 * was actually consumed on it. A part returned unused is not billed. Prices are the ones agreed on the case.
 */
export async function closingBill(caseId: string) {
  const [kase, gstInclusive] = await Promise.all([
    db.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        jobsheetNo: true,
        status: true,
        branchId: true,
        customerId: true,
        customer: { select: { name: true } },
        items: { where: { removedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, itemId: true, code: true, name: true, type: true, quantity: true, unitPricePaise: true, gstPercent: true } },
        payments: { where: { kind: "ADVANCE", invoiceId: null }, select: { amountPaise: true } },
        invoice: { select: { invoiceNo: true } },
      },
    }),
    getBooleanRule(RULES.gstInclusive, true),
  ]);
  if (!kase) return null;

  const [usages, catalog] = await Promise.all([
    db.caseItemUsage.findMany({ where: { caseId, kind: { in: ["CONSUMED", "RETURNED_UNUSED"] } }, select: { itemId: true, kind: true } }),
    db.item.findMany({ where: { id: { in: kase.items.map((i) => i.itemId) } }, select: { id: true, hsnSac: true } }),
  ]);
  const consumed = new Set(usages.filter((u) => u.kind === "CONSUMED").map((u) => u.itemId));
  const hsn = new Map(catalog.map((i) => [i.id, i.hsnSac]));

  const lines: ClosingLine[] = kase.items
    .filter((i) => i.type === "SERVICE" || consumed.has(i.itemId))
    .map((i) => ({ key: i.id, itemId: i.itemId, code: i.code, name: i.name, type: i.type, hsnSac: hsn.get(i.itemId) ?? null, quantity: i.quantity, unitPricePaise: i.unitPricePaise, gstPercent: i.gstPercent }));

  return {
    caseId: kase.id,
    jobsheetNo: kase.jobsheetNo,
    status: kase.status,
    branchId: kase.branchId,
    customerId: kase.customerId,
    customerName: kase.customer.name,
    invoiceNo: kase.invoice?.invoiceNo ?? null,
    gstInclusive,
    lines,
    advancePaise: kase.payments.reduce((s, p) => s + p.amountPaise, 0),
  };
}

/** Accessories and products that can be added to the closing bill, with what the branch has in stock. */
export async function closingAccessories(branchId: string): Promise<ClosingAccessory[]> {
  const items = await db.item.findMany({
    where: { isActive: true, type: "ACCESSORY" },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, pricePaise: true, maxDiscountPercent: true, gstPercent: true },
  });
  const stock = await db.stockItem.findMany({ where: { branchId, itemId: { in: items.map((i) => i.id) } }, select: { itemId: true, quantity: true } });
  const held = await db.stockUnit.groupBy({ by: ["itemId"], where: { branchId, status: "RECEIVED", itemId: { in: items.map((i) => i.id) } }, _count: { _all: true } });
  const have = new Map(stock.map((s) => [s.itemId, s.quantity]));
  const reserved = new Map(held.map((h) => [h.itemId, h._count._all]));
  return items
    .map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      pricePaise: i.pricePaise,
      minPricePaise: minPricePaise(i.pricePaise, i.maxDiscountPercent),
      gstPercent: i.gstPercent,
      stock: Math.max(0, (have.get(i.id) ?? 0) - (reserved.get(i.id) ?? 0)),
    }))
    .filter((i) => i.stock > 0);
}

/** Why the case cannot be closed yet, or null. */
export async function closeBlockReason(caseId: string, status: string): Promise<string | null> {
  if (status !== "READY_FOR_DELIVERY") return "Only a case that is ready for delivery can be closed.";
  const pending = await pendingParts(caseId);
  if (pending.length > 0) return `Consume or return these items first: ${pending.join(", ")}.`;
  return null;
}

export type { BillLineInput };
export { billSummary };
