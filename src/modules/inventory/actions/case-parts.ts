"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import type { FormState } from "@/lib/form";
import { consumeCasePart, parseReturn, returnCasePart } from "../case-parts";
import { INVENTORY_PATHS } from "../paths";

/** Branch view: loads a case line inside the user's branch scope. */
async function scopedLine(caseItemId: string) {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  const scope = branchWhere(await getBranchScope(user));
  const line = await db.caseItem.findFirst({
    where: { id: caseItemId, removedAt: null, case: { ...scope } },
    select: { itemId: true, caseId: true },
  });
  return { user, line };
}

function refresh(caseId: string) {
  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
  revalidatePath(`/service/cases/${caseId}`);
}

/** "Consume" on a case line: the user picks the USID and confirms in the dialog, then it is consumed on this case. */
export async function consumePartForCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const unitId = String(formData.get("unitId") ?? "");
  if (!unitId) return { message: "Please fix the highlighted fields.", fieldErrors: { unitId: ["Select the USID to consume"] } };
  try {
    const { user, line } = await scopedLine(caseItemId);
    if (!line) return { message: "Item not found." };
    const res = await consumeCasePart({ caseId: line.caseId, itemId: line.itemId, unitId, userId: user.id });
    if (!res.ok) return { message: res.message };
    refresh(line.caseId);
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** "Return" on a case line: a received part goes back to Head Office before the case closes (reason + remarks required). */
export async function returnPartForCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseReturn(formData);
  if ("error" in parsed) return parsed.error;
  try {
    const { user, line } = await scopedLine(caseItemId);
    if (!line) return { message: "Item not found." };
    const res = await returnCasePart({ caseId: line.caseId, itemId: line.itemId, reason: parsed.reason, remarks: parsed.remarks, photos: parsed.photos, userId: user.id });
    if (!res.ok) return { message: res.message };
    refresh(line.caseId);
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
