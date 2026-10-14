"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { INVENTORY_PATHS } from "../paths";

/**
 * A branch user confirms that a unit allocated to their branch has arrived: ALLOCATED → RECEIVED,
 * with the date and the user. Only the branch the unit was allocated to can do it, and only once.
 */
export async function markUnitReceived(unitId: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.purchasing, "canEdit");
  if (!user.privilege.isBranchBound || !user.branchId) throw new ForbiddenError();
  const branchId = user.branchId;

  const unit = await db.$transaction(async (tx) => {
    // Only matches while the unit is still awaiting receipt at this user's branch.
    const claimed = await tx.stockUnit.updateMany({
      where: { id: unitId, status: "ALLOCATED", allocatedBranchId: branchId },
      data: { status: "RECEIVED", receivedAt: new Date(), receivedById: user.id },
    });
    if (claimed.count === 0) return null;
    // The unit now sits in this branch: its location moves from Head Office and the branch stock count goes up.
    const row = await tx.stockUnit.update({ where: { id: unitId }, data: { branchId }, select: { usid: true, itemId: true, allocatedCaseId: true } });
    await tx.stockItem.upsert({
      where: { branchId_itemId: { branchId, itemId: row.itemId } },
      create: { branchId, itemId: row.itemId, quantity: 1, unitCodes: [], updatedById: user.id },
      update: { quantity: { increment: 1 }, updatedById: user.id },
    });
    await tx.stockUnitEvent.create({
      data: { unitId, action: "RECEIVED", userId: user.id, caseId: row.allocatedCaseId, branchId },
    });
    return row;
  });
  if (!unit) return;

  await logActivity({
    action: "inventory.receive",
    userId: user.id,
    entity: unit.allocatedCaseId ? "Case" : "StockUnit",
    entityId: unit.allocatedCaseId ?? unitId,
    detail: `${unit.usid} received`,
  });
  revalidatePath(INVENTORY_PATHS.purchasing);
  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.billing, "layout");
  if (unit.allocatedCaseId) revalidatePath(`/service/cases/${unit.allocatedCaseId}`);
}
