"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { formPhotos, photoError, saveCasePhotos } from "@/server/case-photos";
import { isOpenStatus, type CaseStatusValue } from "@/modules/service/case-schema";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { allocateSchema } from "../schemas";

/**
 * The Purchase Manager allocates one specific stock unit (by its USID) to a case in any branch.
 * The unit flips AVAILABLE → ALLOCATED only if it is still AVAILABLE, so the same USID can never
 * be allocated twice. Unit, branch stock, request and case link change together or not at all.
 */
export async function allocateUnit(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = allocateSchema.safeParse(pick(formData, ["unitId", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { unitId, note } = parsed.data;
  // Optional photos of the unit, for the branch that receives it.
  const photos = formPhotos(formData);
  const photoMsg = photoError(photos);
  if (photoMsg) return { message: "Please fix the highlighted fields.", fieldErrors: { photos: [photoMsg] } };

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
    requirePurchaseManager(user);

    const result = await db.$transaction(async (tx) => {
      // Lock the request so two allocations can't both count towards the same outstanding quantity.
      await tx.$queryRaw`SELECT "id" FROM "purchase_request" WHERE "id" = ${requestId} FOR UPDATE`;
      const pr = await tx.purchaseRequest.findUnique({
        where: { id: requestId },
        select: { itemId: true, quantity: true, consumedQty: true, status: true, caseId: true, branchId: true },
      });
      if (!pr) throw new FieldError("form", "Request not found.");
      if (!["PENDING", "WITH_PM", "APPROVED"].includes(pr.status)) throw new FieldError("form", "This request is already closed.");
      if (pr.consumedQty >= pr.quantity) throw new FieldError("form", "This request is already fully allocated.");

      // The unit goes to the case this request was raised for. Its branch is the one that must confirm receipt;
      // a request raised without a case falls back to the branch that raised it.
      const kase = pr.caseId
        ? await tx.case.findUnique({ where: { id: pr.caseId }, select: { id: true, branchId: true, status: true, jobsheetNo: true } })
        : null;
      if (kase && !isOpenStatus(kase.status as CaseStatusValue)) throw new FieldError("form", `Case ${kase.jobsheetNo} is already closed`);

      const unit = await tx.stockUnit.findUnique({ where: { id: unitId }, select: { usid: true, itemId: true, branchId: true, status: true } });
      if (!unit) throw new FieldError("unitId", "Select a stock unit");
      if (unit.status !== "AVAILABLE") throw new FieldError("unitId", `${unit.usid} is already allocated`);

      // The guard: only an AVAILABLE unit matches, so a second allocation of this USID updates nothing.
      const claimed = await tx.stockUnit.updateMany({
        where: { id: unitId, status: "AVAILABLE" },
        data: {
          status: "ALLOCATED",
          allocatedAt: new Date(),
          allocatedById: user.id,
          allocatedCaseId: kase?.id ?? null,
          allocatedBranchId: kase?.branchId ?? pr.branchId,
          purchaseRequestId: requestId,
          note,
        },
      });
      if (claimed.count === 0) throw new FieldError("unitId", `${unit.usid} was just allocated by someone else`);

      await tx.stockUnitEvent.create({
        data: { unitId, action: "ALLOCATED", userId: user.id, caseId: kase?.id ?? null, branchId: kase?.branchId ?? pr.branchId, note },
      });

      // Keep the branch stock count (Stock page) in step with the units.
      const stockUpdate = await tx.stockItem.updateMany({
        where: { branchId: unit.branchId, itemId: unit.itemId, quantity: { gte: 1 } },
        data: { quantity: { decrement: 1 }, updatedById: user.id },
      });
      if (stockUpdate.count === 0) throw new FieldError("unitId", "The stock count for this item is out of step. Adjust it on the Stock page first.");

      const done = pr.consumedQty + 1 >= pr.quantity;
      await tx.purchaseRequest.update({
        where: { id: requestId },
        data: {
          consumedQty: { increment: 1 },
          ...(done ? { status: "CONSUMED", reviewedById: user.id, reviewedAt: new Date() } : {}),
        },
      });
      return { usid: unit.usid, caseId: kase?.id ?? null, jobsheetNo: kase?.jobsheetNo ?? null, done };
    });

    // Photos hang off the case (that is where the branch looks), tagged with the unit.
    if (result.caseId) await saveCasePhotos(result.caseId, photos, user.id, { kind: "ALLOCATION_PHOTO", prefix: "allocation", stockUnitId: unitId });

    await logActivity({
      action: "inventory.allocate",
      userId: user.id,
      entity: result.caseId ? "Case" : "PurchaseRequest",
      entityId: result.caseId ?? requestId,
      detail: `${result.usid} allocated${result.jobsheetNo ? ` to ${result.jobsheetNo}` : ""}${result.done ? " (request fulfilled)" : ""}`,
    });
    revalidatePath(INVENTORY_PATHS.purchasing);
    revalidatePath(INVENTORY_PATHS.stock);
    revalidatePath(INVENTORY_PATHS.billing, "layout");
    if (result.caseId) revalidatePath(`/service/cases/${result.caseId}`);
    return { ok: true, message: `${result.usid} allocated${result.jobsheetNo ? ` to ${result.jobsheetNo}` : ""}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    throw e;
  }
}
