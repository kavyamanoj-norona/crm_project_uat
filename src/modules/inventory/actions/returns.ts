"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { getBranchScope } from "@/server/branch-scope";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { ReturnStatus } from "@/generated/prisma/client";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";

// REQUESTED → APPROVED | REJECTED (needs approve), APPROVED → COMPLETED (needs edit).
const FROM: Record<"APPROVED" | "REJECTED" | "COMPLETED", ReturnStatus> = {
  APPROVED: "REQUESTED",
  REJECTED: "REQUESTED",
  COMPLETED: "APPROVED",
};

/** Moves a customer return / warranty claim along its status. The update only matches the expected current status, so a double click can't apply twice. */
export async function updateReturnStatus(id: string, status: keyof typeof FROM): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, status === "COMPLETED" ? "canEdit" : "canApprove");
  requirePurchaseManager(user);
  const scope = await getBranchScope(user);

  const { count } = await db.caseItemReturn.updateMany({
    where: { id, status: FROM[status], ...(scope.branchId ? { case: { branchId: scope.branchId } } : {}) },
    data: { status, reviewedById: user.id, reviewedAt: new Date() },
  });
  if (count === 0) return;

  const row = await db.caseItemReturn.findUnique({ where: { id }, select: { caseId: true, returnType: true } });
  await logActivity({
    action: "case.item_return.status",
    userId: user.id,
    entity: "Case",
    entityId: row?.caseId ?? id,
    detail: `${row?.returnType === "WARRANTY_CLAIM" ? "Warranty claim" : "Return"} ${status.toLowerCase()}`,
  });
  revalidatePath(INVENTORY_PATHS.purchasing);
}
