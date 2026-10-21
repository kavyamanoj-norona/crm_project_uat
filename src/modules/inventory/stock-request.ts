import "server-only";
import type { Tx } from "@/server/db";
import { nextSequence } from "@/server/sequence";

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () => periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

export type StockRequestLine = { itemId: string; quantity: number };

/**
 * A branch's Stock Request: the header plus one ordinary PurchaseRequest per item. The lines are what Head Office sees on the
 * Purchasing Requests tab and what follows the order → transfer → receipt flow, exactly as an item-level request always did.
 */
export async function createStockRequest(
  tx: Tx,
  o: { branchId: string; branchCode: string; userId: string; notes: string | null; lines: StockRequestLine[] },
) {
  const p = period();
  const branch = o.branchCode.toUpperCase();
  const srSeq = await nextSequence(tx, `SR:${o.branchCode}:${p}`);
  const code = `SR-${branch}-${p}-${String(srSeq).padStart(3, "0")}`;
  const header = await tx.stockRequest.create({ data: { code, branchId: o.branchId, notes: o.notes, requestedById: o.userId }, select: { id: true } });
  for (const line of o.lines) {
    const seq = await nextSequence(tx, `PR:${o.branchCode}:${p}`);
    await tx.purchaseRequest.create({
      data: {
        code: `PR-${branch}-${p}-${String(seq).padStart(3, "0")}`,
        branchId: o.branchId,
        itemId: line.itemId,
        quantity: line.quantity,
        caseId: null,
        notes: o.notes,
        requestedById: o.userId,
        stockRequestId: header.id,
      },
    });
  }
  return { id: header.id, code };
}
