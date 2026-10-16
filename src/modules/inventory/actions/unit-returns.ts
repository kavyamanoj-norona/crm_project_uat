"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import type { ActionResult } from "@/lib/form";
import { receiveReturnedUnit } from "../case-parts";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";

/** Purchase Returns: confirm that the returned unit has reached Head Office. */
export async function markReturnReceived(unitId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
    requirePurchaseManager(user);
    const res = await receiveReturnedUnit(unitId, user.id);
    if (res.ok) revalidatePath(INVENTORY_PATHS.purchasing);
    return res;
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
