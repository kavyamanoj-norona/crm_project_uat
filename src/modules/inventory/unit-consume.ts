import "server-only";
import type { Tx } from "@/server/db";

/**
 * Units a branch has received but not yet used, per item. They are held for a case, so the manual
 * "Consume" buttons must not use them up: a unit is consumed only when its case is closed.
 */
export async function receivedUnitCount(tx: Tx, branchId: string, itemId: string) {
  return tx.stockUnit.count({ where: { branchId, itemId, status: "RECEIVED" } });
}

/**
 * The case was closed (billed and handed over): every unit received for it is now consumed, and the
 * branch stock count goes down with it.
 */
export async function markCaseUnitsConsumed(tx: Tx, caseId: string, userId: string) {
  const units = await tx.stockUnit.findMany({
    where: { allocatedCaseId: caseId, status: "RECEIVED" },
    select: { id: true, itemId: true, branchId: true },
  });
  const now = new Date();
  for (const u of units) {
    const done = await tx.stockUnit.updateMany({
      where: { id: u.id, status: "RECEIVED" },
      data: { status: "CONSUMED", consumedAt: now, consumedById: userId },
    });
    if (done.count === 0) continue;
    await tx.stockUnitEvent.create({
      data: { unitId: u.id, action: "CONSUMED", userId, caseId, branchId: u.branchId, note: "Case closed" },
    });
    await tx.stockItem.updateMany({
      where: { branchId: u.branchId, itemId: u.itemId, quantity: { gte: 1 } },
      data: { quantity: { decrement: 1 }, updatedById: userId },
    });
  }
  return units.length;
}
