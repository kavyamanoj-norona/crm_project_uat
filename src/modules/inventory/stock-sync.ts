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
    where: { status: { in: ["AVAILABLE", "RECEIVED"] } },
    _count: { _all: true },
  });
  if (groups.length === 0) return;
  const rows = await db.stockItem.findMany({
    where: { OR: groups.map((g) => ({ branchId: g.branchId, itemId: g.itemId })) },
    select: { branchId: true, itemId: true, quantity: true },
  });
  const have = new Map(rows.map((r) => [`${r.branchId}:${r.itemId}`, r.quantity]));
  for (const g of groups) {
    const onHand = g._count._all;
    const current = have.get(`${g.branchId}:${g.itemId}`);
    if (current === undefined) {
      await db.stockItem.create({ data: { branchId: g.branchId, itemId: g.itemId, quantity: onHand, unitCodes: [] } });
    } else if (current < onHand) {
      await db.stockItem.updateMany({ where: { branchId: g.branchId, itemId: g.itemId }, data: { quantity: onHand } });
    }
  }
}
