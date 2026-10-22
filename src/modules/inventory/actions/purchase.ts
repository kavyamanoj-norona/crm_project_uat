"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { toFieldErrors, pick, type FormState } from "@/lib/form";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { isEngineer } from "@/server/rbac/roles";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { formPhotos, photoError, requiredPhotoError, saveCasePhotos, saveStockPhotos } from "@/server/case-photos";
import { logActivity } from "@/server/security/activity";
import { nextSequence } from "@/server/sequence";
import type { PurchaseRequestStatus } from "@/generated/prisma/client";
import { canRequestParts, type CaseStatusValue } from "@/modules/service/case-schema";
import { createReplacementRequest } from "../replacement";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { createStockRequest } from "../stock-request";
import { partRequestSchema, purchaseRequestSchema, stockRequestSchema } from "../schemas";

const periodFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "2-digit",
  month: "2-digit",
});

function period() {
  return periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");
}

export async function raisePurchaseRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  requirePurchaseManager(await requireActionPermission(INVENTORY_PATHS.stock, "canCreate"));
  const raw = pick(formData, ["itemId", "caseId", "notes"]);
  const parsed = purchaseRequestSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
  const scope = await getBranchScope(user);
  const branchId = scope.branchId ?? (formData.get("branchId") as string | null);
  if (!branchId) return { ok: false, message: "Select a branch first using the header switcher." };

  const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });
  const { itemId, caseId, notes } = parsed.data;

  await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `PR:${branch.code}:${period()}`);
    const code = `PR-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
    await tx.purchaseRequest.create({
      // A request is always one item: each one is transferred, received and consumed on its own USID.
      data: { code, branchId, itemId, quantity: 1, caseId: caseId ?? null, notes: notes ?? null, requestedById: user.id },
    });
  });

  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
  redirect(`${INVENTORY_PATHS.purchasing}?saved=${Date.now()}`);
}

/**
 * A branch requests stock of a part or accessory from Head Office straight from the Items catalog, with no case.
 * One request can ask for several units; the Purchase Manager later gives each unit its own USID and transfers them together.
 */
export async function requestItemStock(itemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = stockRequestSchema.safeParse(pick(formData, ["quantity", "notes"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  // At least one image (uploaded or taken with the camera) must come with every request.
  const photos = formPhotos(formData);
  const photoMsg = requiredPhotoError(photos);
  if (photoMsg) return { message: "Please fix the highlighted fields.", fieldErrors: { photos: [photoMsg] } };
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.purchasing, "canCreate");
    // Stock requests are for Front Desk and Branch Managers; engineers never raise them, whatever permissions they hold.
    if (isEngineer(user)) throw new ForbiddenError();
    // Only branch users request from Head Office; the Purchase Manager raises requests on the Purchasing page.
    if (!user.privilege.isBranchBound || !user.branchId) throw new ForbiddenError();
    const branchId = user.branchId;

    const item = await db.item.findFirst({ where: { id: itemId, isActive: true }, select: { name: true, type: true } });
    if (!item) return { message: "Item not found." };
    if (item.type !== "PART" && item.type !== "ACCESSORY") return { message: "Only spare parts and accessories can be requested." };

    const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });
    const { quantity, notes } = parsed.data;
    // Recorded as a one-line Stock Request, so it shows in the branch's Stock Requests list; Head Office still sees the same PurchaseRequest.
    const { id: requestId, code } = await db.$transaction((tx) =>
      createStockRequest(tx, { branchId, branchCode: branch.code, userId: user.id, notes: notes ?? null, lines: [{ itemId, quantity }] }),
    );
    await saveStockPhotos(requestId, photos, user.id, { kind: "STOCK_REQUEST_PHOTO", prefix: "request", stockRequestId: requestId });
    await logActivity({
      action: "inventory.request",
      userId: user.id,
      entity: "StockRequest",
      entityId: code,
      detail: `${code}: requested ${quantity} × ${item.name} from Head Office`,
    });
    revalidatePath(INVENTORY_PATHS.purchasing);
    return { ok: true, message: `Requested ${quantity} × ${item.name} (${code}).` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/**
 * Reorder a part for the case because the unit already received is defective. The dialog confirms it; the reason is
 * required and, with the person who confirmed, is shown to the Purchase Manager on the Replacement / Reorder request.
 */
export async function reorderPartForCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { message: "Please fix the highlighted fields.", fieldErrors: { reason: ["Explain why it needs to be reordered"] } };
  if (reason.length > 300) return { message: "Please fix the highlighted fields.", fieldErrors: { reason: ["Keep the reason under 300 characters"] } };
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
    // Case-linked stock requests are for Front Desk and Branch Managers only; engineers never raise them.
    if (isEngineer(user)) throw new ForbiddenError();
    const scope = branchWhere(await getBranchScope(user));
    const line = await db.caseItem.findFirst({
      where: { id: caseItemId, removedAt: null, case: { ...scope } },
      select: { itemId: true, caseId: true },
    });
    if (!line) return { message: "Item not found." };
    const res = await createReplacementRequest({ caseId: line.caseId, itemId: line.itemId, reason, userId: user.id });
    if (!res.ok) return { message: res.message };
    revalidatePath(INVENTORY_PATHS.purchasing);
    revalidatePath(`/service/cases/${line.caseId}`);
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Part request from a case line: model number required; notes and photos of the part are optional. */
export async function requestPartForCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = partRequestSchema.safeParse(pick(formData, ["modelNo", "notes"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const photos = formPhotos(formData);
  const photoMsg = photoError(photos);
  if (photoMsg) return { message: "Please fix the highlighted fields.", fieldErrors: { photos: [photoMsg] } };

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
    // Case-linked stock requests are for Front Desk and Branch Managers only; engineers never raise them.
    if (isEngineer(user)) throw new ForbiddenError();
    const scope = branchWhere(await getBranchScope(user));
    const line = await db.caseItem.findFirst({
      where: { id: caseItemId, removedAt: null, case: { ...scope } },
      select: { itemId: true, quantity: true, caseId: true, case: { select: { branchId: true, status: true } } },
    });
    if (!line) return { message: "Item not found." };
    if (!canRequestParts(line.case.status as CaseStatusValue)) return { message: "Parts can be requested once the approval is complete." };
    const { itemId, caseId, case: { branchId } } = line;
    const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });

    const requestId = await db.$transaction(async (tx) => {
      const seq = await nextSequence(tx, `PR:${branch.code}:${period()}`);
      const code = `PR-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
      const pr = await tx.purchaseRequest.create({
        data: { code, branchId, itemId, quantity: 1, caseId, modelNo: parsed.data.modelNo, notes: parsed.data.notes, requestedById: user.id },
        select: { id: true },
      });
      return pr.id;
    });
    if (photos.length > 0) await saveCasePhotos(caseId, photos, user.id, { kind: "PART_REQUEST_PHOTO", prefix: "request", purchaseRequestId: requestId });

    revalidatePath(INVENTORY_PATHS.stock);
    revalidatePath(INVENTORY_PATHS.purchasing);
    revalidatePath(`/service/cases/${caseId}`);
    return { ok: true, message: "Part requested." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Requests → Ordered: the Purchase Manager has ordered the item. Starts the Ordered turnaround clock. */
export async function markRequestOrdered(id: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  requirePurchaseManager(user);
  const done = await db.purchaseRequest.updateMany({
    where: { id, status: { in: ["PENDING", "WITH_PM", "APPROVED", "SPARE_UNAVAILABLE"] } },
    data: { status: "ORDERED", orderedAt: new Date(), orderedById: user.id },
  });
  if (done.count > 0) {
    await logActivity({ action: "inventory.order", userId: user.id, entity: "PurchaseRequest", entityId: id, detail: "Marked as ordered" });
  }
  revalidatePath(INVENTORY_PATHS.purchasing);
}

/** Requests: the Purchase Manager cannot get the spare right now. Kept on the Requests tab with an optional remark. */
export async function markSpareUnavailable(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const remark = String(formData.get("remarks") ?? "").trim();
  if (remark.length > 300) return { message: "Please fix the highlighted fields.", fieldErrors: { remarks: ["Keep the remark under 300 characters"] } };
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
    requirePurchaseManager(user);
    const done = await db.purchaseRequest.updateMany({
      where: { id, status: { in: ["PENDING", "WITH_PM", "APPROVED"] } },
      data: { status: "SPARE_UNAVAILABLE", pmRemarks: remark || null },
    });
    if (done.count === 0) return { message: "This request can no longer be changed." };
    await logActivity({ action: "inventory.spare-unavailable", userId: user.id, entity: "PurchaseRequest", entityId: id, detail: remark || "Spare not available" });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
  revalidatePath(INVENTORY_PATHS.purchasing);
  return { ok: true, message: "Marked as spare not available." };
}

export async function receiveStock(purchaseRequestId: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  requirePurchaseManager(user);
  const pr = await db.purchaseRequest.findUniqueOrThrow({
    where: { id: purchaseRequestId },
    select: { branchId: true, itemId: true, quantity: true, status: true },
  });
  if (pr.status !== "APPROVED") return;

  await db.$transaction(async (tx) => {
    await tx.purchaseRequest.update({ where: { id: purchaseRequestId }, data: { status: "FULFILLED" } });
    await tx.stockItem.upsert({
      where: { branchId_itemId: { branchId: pr.branchId, itemId: pr.itemId } },
      create: { branchId: pr.branchId, itemId: pr.itemId, quantity: pr.quantity, unitCodes: [], updatedById: user.id },
      update: { quantity: { increment: pr.quantity }, updatedById: user.id },
    });
  });

  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: Extract<PurchaseRequestStatus, "WITH_PM" | "APPROVED" | "REJECTED" | "FULFILLED">,
): Promise<void> {
  const needsApprove = status === "APPROVED" || status === "REJECTED";
  const user = await requireActionPermission(INVENTORY_PATHS.stock, needsApprove ? "canApprove" : "canEdit");
  requirePurchaseManager(user);
  await db.purchaseRequest.update({
    where: { id },
    data: {
      status,
      ...(needsApprove ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
    },
  });
  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
}
