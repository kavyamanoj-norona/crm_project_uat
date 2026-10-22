"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { formPhotos, requiredPhotoError, saveCasePhotos, saveStockPhotos } from "@/server/case-photos";
import { isChipLabStatus, isOpenStatus, type CaseStatusValue } from "@/modules/service/case-schema";
import { getHeadOfficeBranch } from "../head-office";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { allocateManySchema, allocateSchema } from "../schemas";

/**
 * The Purchase Manager transfers every remaining unit of an Ordered request in one go, giving each unit its own USID
 * (`unitId` repeated once per unit). The number of USIDs must match the outstanding quantity, every USID must be distinct,
 * of the requested item and still AVAILABLE. All units, branch stock counts and the request change together or not at all.
 */
export async function allocateUnits(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = allocateManySchema.safeParse(pick(formData, ["note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { note } = parsed.data;
  // At least one photo of the units is required, for the branch that receives them.
  const photos = formPhotos(formData);
  const photoMsg = requiredPhotoError(photos);
  if (photoMsg) return { message: "Please fix the highlighted fields.", fieldErrors: { photos: [photoMsg] } };
  const unitIds = formData.getAll("unitId").map(String).filter(Boolean);
  if (new Set(unitIds).size !== unitIds.length) return { message: "Each unit needs its own USID.", fieldErrors: { unitId: ["Each unit needs its own USID"] } };

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
    requirePurchaseManager(user);

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "purchase_request" WHERE "id" = ${requestId} FOR UPDATE`;
      const pr = await tx.purchaseRequest.findUnique({
        where: { id: requestId },
        select: { code: true, itemId: true, quantity: true, consumedQty: true, status: true, caseId: true, branchId: true },
      });
      if (!pr) throw new FieldError("form", "Request not found.");
      if (["PENDING", "WITH_PM", "APPROVED", "SPARE_UNAVAILABLE"].includes(pr.status)) throw new FieldError("form", "Mark the request as ordered before transferring units.");
      if (pr.status !== "ORDERED") throw new FieldError("form", "This request is already closed.");
      const remaining = pr.quantity - pr.consumedQty;
      if (remaining <= 0) throw new FieldError("form", "This request is already fully allocated.");
      if (unitIds.length !== remaining) throw new FieldError("unitId", `Select ${remaining} USID${remaining === 1 ? "" : "s"}, one for each unit (${unitIds.length} selected).`);

      const kase = pr.caseId
        ? await tx.case.findUnique({ where: { id: pr.caseId }, select: { id: true, branchId: true, status: true, jobsheetNo: true } })
        : null;
      if (kase && !isOpenStatus(kase.status as CaseStatusValue)) throw new FieldError("form", `Case ${kase.jobsheetNo} is already closed`);
      // A case in the chip-level lab is served from Head Office, so its parts are received there, not at the case's branch.
      const toBranchId = kase && isChipLabStatus(kase.status as CaseStatusValue) ? (await getHeadOfficeBranch(tx)).id : (kase?.branchId ?? pr.branchId);

      const usids: string[] = [];
      for (const unitId of unitIds) {
        const unit = await tx.stockUnit.findUnique({ where: { id: unitId }, select: { usid: true, itemId: true, branchId: true, status: true, isOfficeUse: true } });
        if (!unit) throw new FieldError("unitId", "Select valid stock units");
        if (unit.itemId !== pr.itemId) throw new FieldError("unitId", `${unit.usid} is not the requested item`);
        if (unit.status !== "AVAILABLE") throw new FieldError("unitId", `${unit.usid} is already allocated`);
        if (unit.isOfficeUse) throw new FieldError("unitId", `${unit.usid} is office-use stock and can't be transferred`);

        const claimed = await tx.stockUnit.updateMany({
          where: { id: unitId, status: "AVAILABLE" },
          data: {
            status: "ALLOCATED",
            allocatedAt: new Date(),
            allocatedById: user.id,
            allocatedCaseId: kase?.id ?? null,
            allocatedBranchId: toBranchId,
            purchaseRequestId: requestId,
            note,
          },
        });
        if (claimed.count === 0) throw new FieldError("unitId", `${unit.usid} was just allocated by someone else`);
        await tx.stockUnitEvent.create({ data: { unitId, action: "ALLOCATED", userId: user.id, caseId: kase?.id ?? null, branchId: toBranchId, note } });
        const stockUpdate = await tx.stockItem.updateMany({
          where: { branchId: unit.branchId, itemId: unit.itemId, quantity: { gte: 1 } },
          data: { quantity: { decrement: 1 }, updatedById: user.id },
        });
        if (stockUpdate.count === 0) throw new FieldError("unitId", "The stock count for this item is out of step. Adjust it on the Stock page first.");
        usids.push(unit.usid);
      }

      await tx.purchaseRequest.update({
        where: { id: requestId },
        data: { consumedQty: { increment: unitIds.length }, status: "TRANSFERRED", transferredAt: new Date() },
      });
      return { code: pr.code, usids, caseId: kase?.id ?? null, jobsheetNo: kase?.jobsheetNo ?? null };
    });

    // Photos hang off the case (that is where the branch looks); a transfer with no case keeps them on the request.
    if (result.caseId) await saveCasePhotos(result.caseId, photos, user.id, { kind: "ALLOCATION_PHOTO", prefix: "allocation", purchaseRequestId: requestId });
    else await saveStockPhotos(requestId, photos, user.id, { kind: "TRANSFER_PHOTO", prefix: "transfer", purchaseRequestId: requestId });

    await logActivity({
      action: "inventory.allocate",
      userId: user.id,
      entity: result.caseId ? "Case" : "PurchaseRequest",
      entityId: result.caseId ?? requestId,
      detail: `${result.code}: ${result.usids.join(", ")} transferred${result.jobsheetNo ? ` to ${result.jobsheetNo}` : ""} (request fully transferred)`,
    });
    revalidatePath(INVENTORY_PATHS.purchasing);
    revalidatePath(INVENTORY_PATHS.stock);
    revalidatePath(INVENTORY_PATHS.billing, "layout");
    if (result.caseId) revalidatePath(`/service/cases/${result.caseId}`);
    return { ok: true, message: `${result.usids.length} units transferred.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    throw e;
  }
}

/**
 * The Purchase Manager allocates one specific stock unit (by its USID) to a case in any branch.
 * The unit flips AVAILABLE → ALLOCATED only if it is still AVAILABLE, so the same USID can never
 * be allocated twice. The request must be Ordered first; allocating its last unit marks it Transferred. Unit, branch stock, request and case link change together or not at all.
 */
export async function allocateUnit(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = allocateSchema.safeParse(pick(formData, ["unitId", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { unitId, note } = parsed.data;
  // At least one photo of the unit is required, for the branch that receives it.
  const photos = formPhotos(formData);
  const photoMsg = requiredPhotoError(photos);
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
      if (["PENDING", "WITH_PM", "APPROVED", "SPARE_UNAVAILABLE"].includes(pr.status)) throw new FieldError("form", "Mark the request as ordered before transferring a unit.");
      if (pr.status !== "ORDERED") throw new FieldError("form", "This request is already closed.");
      if (pr.consumedQty >= pr.quantity) throw new FieldError("form", "This request is already fully allocated.");

      // The unit goes to the case this request was raised for. Its branch is the one that must confirm receipt;
      // a request raised without a case falls back to the branch that raised it.
      const kase = pr.caseId
        ? await tx.case.findUnique({ where: { id: pr.caseId }, select: { id: true, branchId: true, status: true, jobsheetNo: true } })
        : null;
      if (kase && !isOpenStatus(kase.status as CaseStatusValue)) throw new FieldError("form", `Case ${kase.jobsheetNo} is already closed`);

      const toBranchId = kase && isChipLabStatus(kase.status as CaseStatusValue) ? (await getHeadOfficeBranch(tx)).id : (kase?.branchId ?? pr.branchId);

      const unit = await tx.stockUnit.findUnique({ where: { id: unitId }, select: { usid: true, itemId: true, branchId: true, status: true, isOfficeUse: true } });
      if (!unit) throw new FieldError("unitId", "Select a stock unit");
      if (unit.itemId !== pr.itemId) throw new FieldError("unitId", `${unit.usid} is not the requested item`);
      if (unit.status !== "AVAILABLE") throw new FieldError("unitId", `${unit.usid} is already allocated`);
        if (unit.isOfficeUse) throw new FieldError("unitId", `${unit.usid} is office-use stock and can't be transferred`);

      // The guard: only an AVAILABLE unit matches, so a second allocation of this USID updates nothing.
      const claimed = await tx.stockUnit.updateMany({
        where: { id: unitId, status: "AVAILABLE" },
        data: {
          status: "ALLOCATED",
          allocatedAt: new Date(),
          allocatedById: user.id,
          allocatedCaseId: kase?.id ?? null,
          allocatedBranchId: toBranchId,
          purchaseRequestId: requestId,
          note,
        },
      });
      if (claimed.count === 0) throw new FieldError("unitId", `${unit.usid} was just allocated by someone else`);

      await tx.stockUnitEvent.create({
        data: { unitId, action: "ALLOCATED", userId: user.id, caseId: kase?.id ?? null, branchId: toBranchId, note },
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
          ...(done ? { status: "TRANSFERRED", transferredAt: new Date() } : {}),
        },
      });
      return { usid: unit.usid, caseId: kase?.id ?? null, jobsheetNo: kase?.jobsheetNo ?? null, done };
    });

    // Photos hang off the case (that is where the branch looks), tagged with the unit.
    // A transfer with no case keeps its photos on the request instead.
    if (result.caseId) await saveCasePhotos(result.caseId, photos, user.id, { kind: "ALLOCATION_PHOTO", prefix: "allocation", stockUnitId: unitId });
    else await saveStockPhotos(requestId, photos, user.id, { kind: "TRANSFER_PHOTO", prefix: "transfer", purchaseRequestId: requestId, stockUnitId: unitId });

    await logActivity({
      action: "inventory.allocate",
      userId: user.id,
      entity: result.caseId ? "Case" : "PurchaseRequest",
      entityId: result.caseId ?? requestId,
      detail: `${result.usid} transferred${result.jobsheetNo ? ` to ${result.jobsheetNo}` : ""}${result.done ? " (request fully transferred)" : ""}`,
    });
    revalidatePath(INVENTORY_PATHS.purchasing);
    revalidatePath(INVENTORY_PATHS.stock);
    revalidatePath(INVENTORY_PATHS.billing, "layout");
    if (result.caseId) revalidatePath(`/service/cases/${result.caseId}`);
    return { ok: true, message: `${result.usid} transferred${result.jobsheetNo ? ` to ${result.jobsheetNo}` : ""}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    throw e;
  }
}
