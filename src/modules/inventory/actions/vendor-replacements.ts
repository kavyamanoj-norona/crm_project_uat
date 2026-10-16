"use server";

import { revalidatePath } from "next/cache";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import type { ActionResult, FormState } from "@/lib/form";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { markVendorReplacementReady, receiveDefectiveReturn, transferVendorReplacement } from "../vendor-replacement";

async function pm() {
  const user = await requireActionPermission(INVENTORY_PATHS.vendorReplacements, "canEdit");
  requirePurchaseManager(user);
  return user;
}
function refresh() {
  revalidatePath(INVENTORY_PATHS.vendorReplacements);
  revalidatePath(INVENTORY_PATHS.purchasing);
  revalidatePath(INVENTORY_PATHS.stock);
}

/** The vendor has the replacement ready (same USID). Optional vendor name and remarks. */
export async function vendorReplacementReady(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const vendor = String(formData.get("vendor") ?? "").trim().slice(0, 120);
  const remarks = String(formData.get("remarks") ?? "").trim().slice(0, 300);
  try {
    const user = await pm();
    const res = await markVendorReplacementReady(id, user.id, vendor, remarks);
    if (!res.ok) return { message: res.message };
    refresh();
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Transfer the replacement (same USID) to the branch, without waiting for the defective unit to reach Head Office. */
export async function vendorReplacementTransfer(id: string): Promise<ActionResult> {
  try {
    const user = await pm();
    const res = await transferVendorReplacement(id, user.id);
    if (res.ok) refresh();
    return res;
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Confirm the defective unit has reached Head Office (tracked separately from the replacement). */
export async function vendorReplacementReturnReceived(id: string): Promise<ActionResult> {
  try {
    const user = await pm();
    const res = await receiveDefectiveReturn(id, user.id);
    if (res.ok) refresh();
    return res;
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
