import "server-only";
import { db } from "@/server/db";

/**
 * Keeps the Stock page honest about purchased units. Every unit on hand (AVAILABLE at Head Office, or RECEIVED
 * and not yet used at a branch) must be counted in its location stock. A missing stock row is created, and a
 * count below the number of units on hand is raised to it. Stock above the unit count (adjustments entered
 * without USIDs) is left alone.
 */
export async function syncStockWithUnits() {
  const groups = await db.stockUnit.groupBy({
    by: ["branchId", "itemId"],
    // Office-use units are not branch stock, so they never create or raise a stock count.
    where: { status: { in: ["AVAILABLE", "RECEIVED"] }, isOfficeUse: false },
    _count: { _all: true },
  });
  if (groups.length === 0) return;
  // Concurrent page loads can run this at the same time, so a missing row is created with skipDuplicates
  // (a row that appeared meanwhile is simply left) and counts are only ever raised, never lowered.
  for (const g of groups) {
    const onHand = g._count._all;
    await db.stockItem.createMany({ data: [{ branchId: g.branchId, itemId: g.itemId, quantity: onHand, unitCodes: [] }], skipDuplicates: true });
    await db.stockItem.updateMany({ where: { branchId: g.branchId, itemId: g.itemId, quantity: { lt: onHand } }, data: { quantity: onHand } });
  }
}
