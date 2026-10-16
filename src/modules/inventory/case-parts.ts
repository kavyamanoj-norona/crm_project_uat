import "server-only";
import { db } from "@/server/db";
import { logActivity } from "@/server/security/activity";
import type { ActionResult, FormState } from "@/lib/form";
import { canRequestParts, type CaseStatusValue } from "@/modules/service/case-schema";
import { getHeadOfficeBranch } from "./head-office";
import { createReplacementRequest } from "./replacement";
import { createVendorReplacement } from "./vendor-replacement";
import { postCogs } from "@/modules/finance/posting";

/**
 * Why a received part goes back before the case closes:
 * - UNUSED: not needed after all; the unit returns to Head Office stock and can be allocated again.
 * - COURIER_DAMAGE: damaged in transit or at the branch; the unit goes to the Purchase Returns tab and a replacement is bought.
 * - DEFECTIVE: defective or not working; the unit waits for the vendor to replace it, and the replacement reuses the same USID.
 */
export const RETURN_REASONS = ["UNUSED", "COURIER_DAMAGE", "DEFECTIVE"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  UNUSED: "Not needed (unused)",
  COURIER_DAMAGE: "Courier / Branch damage",
  DEFECTIVE: "Defective / Not working",
};

/** Shared by the branch and lab return actions: validates the reason and remarks. */
export function parseReturn(formData: FormData): { reason: ReturnReason; remarks: string } | { error: FormState } {
  const reason = String(formData.get("reason") ?? "") as ReturnReason;
  const remarks = String(formData.get("remarks") ?? "").trim();
  const errors: Record<string, string[]> = {};
  if (!(RETURN_REASONS as readonly string[]).includes(reason)) errors.reason = ["Select a return reason"];
  if (remarks.length < 3) errors.remarks = ["Add remarks explaining the return"];
  if (remarks.length > 300) errors.remarks = ["Keep the remarks under 300 characters"];
  if (Object.keys(errors).length > 0) return { error: { message: "Please fix the highlighted fields.", fieldErrors: errors } };
  return { reason, remarks };
}

const isPhysical = (t: string) => t === "PART" || t === "ACCESSORY";

/**
 * Parts on the case that still have to be consumed (or returned unused) before it can move to Quality check.
 * Returns the item names; empty when everything is settled or the case has no physical parts.
 */
export async function pendingParts(caseId: string): Promise<string[]> {
  const [lines, usages] = await Promise.all([
    db.caseItem.findMany({ where: { caseId, removedAt: null }, select: { itemId: true, name: true, type: true } }),
    db.caseItemUsage.findMany({ where: { caseId, kind: { in: ["CONSUMED", "RETURNED_UNUSED"] } }, select: { itemId: true } }),
  ]);
  const settled = new Set(usages.map((u) => u.itemId));
  const names = new Map<string, string>();
  for (const l of lines) if (isPhysical(l.type) && !settled.has(l.itemId)) names.set(l.itemId, l.name);
  return [...names.values()];
}

/** The message that blocks Quality check, or null when all parts are settled. */
export async function qcConsumptionBlock(caseId: string): Promise<string | null> {
  const pending = await pendingParts(caseId);
  return pending.length === 0 ? null : `Consume or return these items before Quality check: ${pending.join(", ")}.`;
}

/** One USID a user can pick when consuming a part on a case. */
export type ConsumableUnit = { id: string; usid: string; mine: boolean; otherCase: string | null };

/**
 * The USIDs that can be consumed for these items on a case: every unit received at the case's branch and not yet used.
 * The one allocated to this case is marked `mine`; the others belong to other cases and are offered only for urgent reuse.
 */
export async function consumableUnits(caseId: string, branchId: string, itemIds: string[]): Promise<Record<string, ConsumableUnit[]>> {
  if (itemIds.length === 0) return {};
  const units = await db.stockUnit.findMany({
    where: { branchId, itemId: { in: itemIds }, status: "RECEIVED" },
    orderBy: [{ receivedAt: "asc" }, { usid: "asc" }],
    select: { id: true, usid: true, itemId: true, allocatedCaseId: true, allocatedCase: { select: { jobsheetNo: true } } },
  });
  const out: Record<string, ConsumableUnit[]> = {};
  for (const u of units) {
    (out[u.itemId] ??= []).push({ id: u.id, usid: u.usid, mine: u.allocatedCaseId === caseId, otherCase: u.allocatedCaseId === caseId ? null : (u.allocatedCase?.jobsheetNo ?? null) });
  }
  for (const list of Object.values(out)) list.sort((a, b) => Number(b.mine) - Number(a.mine));
  return out;
}

/** The USID allocated to each item of the case (transferred, received or consumed), for the badge beside the item. */
export async function caseUsids(caseId: string): Promise<Record<string, string>> {
  const units = await db.stockUnit.findMany({
    where: { allocatedCaseId: caseId, status: { in: ["ALLOCATED", "RECEIVED", "CONSUMED"] } },
    orderBy: { allocatedAt: "asc" },
    select: { itemId: true, usid: true },
  });
  return Object.fromEntries(units.map((u) => [u.itemId, u.usid]));
}

/**
 * Consumes a part on the case, always with an explicit choice and confirmation from the user:
 * - `unitId` is the USID picked in the dialog. It must be received at the case's branch and unused. The unit allocated to
 *   this case is the normal choice; another case's unit can be used in an urgent case, and is then re-allocated to this one
 *   (both cases and the USID history show it). The USID becomes Consumed and branch stock drops by one.
 * - `unitId` = "stock" uses one unit of branch stock that has no USID.
 * Either way it is recorded against the case (USID, case, user) in the usage record and the activity log.
 */
export async function consumeCasePart(opts: { caseId: string; itemId: string; unitId: string; userId: string }): Promise<ActionResult> {
  if (!opts.unitId) return { ok: false, message: "Select the USID to consume." };
  const kase = await db.case.findUnique({ where: { id: opts.caseId }, select: { branchId: true, jobsheetNo: true, status: true } });
  if (!kase) return { ok: false, message: "Case not found." };
  // Nothing is consumed before the customer has approved the estimate.
  if (!canRequestParts(kase.status as CaseStatusValue)) return { ok: false, message: "Items can be consumed once the customer has approved the estimate." };
  const item = await db.item.findUnique({ where: { id: opts.itemId }, select: { name: true, type: true } });
  if (!item || !isPhysical(item.type)) return { ok: false, message: "Only parts and accessories are consumed." };

  const result = await db.$transaction(async (tx) => {
    const settled = await tx.caseItemUsage.findFirst({ where: { caseId: opts.caseId, itemId: opts.itemId, kind: { in: ["CONSUMED", "RETURNED_UNUSED"] } } });
    if (settled) return { ok: false as const, message: "This item is already consumed for this case." };

    if (opts.unitId !== "stock") {
      const unit = await tx.stockUnit.findUnique({
        where: { id: opts.unitId },
        select: { id: true, usid: true, itemId: true, status: true, branchId: true, allocatedCaseId: true, allocatedCase: { select: { jobsheetNo: true } }, billItem: { select: { taxablePaise: true, quantity: true } } },
      });
      if (!unit || unit.itemId !== opts.itemId) return { ok: false as const, message: "That USID is not for this item." };
      if (unit.status !== "RECEIVED" || unit.branchId !== kase.branchId) return { ok: false as const, message: `${unit.usid} is not available at this branch.` };

      const reusedFrom = unit.allocatedCaseId && unit.allocatedCaseId !== opts.caseId ? unit.allocatedCase?.jobsheetNo ?? "another case" : null;
      const claimed = await tx.stockUnit.updateMany({
        where: { id: unit.id, status: "RECEIVED" },
        data: { status: "CONSUMED", consumedAt: new Date(), consumedById: opts.userId, ...(reusedFrom ? { allocatedCaseId: opts.caseId } : {}) },
      });
      if (claimed.count === 0) return { ok: false as const, message: "This unit was just used by someone else." };
      if (reusedFrom) {
        await tx.stockUnitEvent.create({
          data: { unitId: unit.id, action: "ALLOCATED", userId: opts.userId, caseId: opts.caseId, branchId: unit.branchId, note: `Urgent reuse: re-allocated from ${reusedFrom} to ${kase.jobsheetNo}` },
        });
      }
      await tx.stockUnitEvent.create({ data: { unitId: unit.id, action: "CONSUMED", userId: opts.userId, caseId: opts.caseId, branchId: unit.branchId } });
      await tx.stockItem.updateMany({ where: { branchId: unit.branchId, itemId: opts.itemId, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 }, updatedById: opts.userId } });
      await tx.caseItemUsage.create({ data: { caseId: opts.caseId, itemId: opts.itemId, kind: "CONSUMED", stockUnitId: unit.id, userId: opts.userId } });
      // Its purchase cost (net of discount, before GST) moves from Inventory to Cost of Goods Sold.
      if (unit.billItem && unit.billItem.quantity > 0) {
        await postCogs(tx, { unitId: unit.id, usid: unit.usid, branchId: unit.branchId, costPaise: Math.round(unit.billItem.taxablePaise / unit.billItem.quantity), jobsheetNo: kase.jobsheetNo }, opts.userId);
      }
      return {
        ok: true as const,
        message: `${unit.usid} consumed.`,
        detail: `${item.name} ${unit.usid} consumed on ${kase.jobsheetNo}${reusedFrom ? ` (urgent reuse of the unit allocated to ${reusedFrom})` : ""}`,
      };
    }

    // A unit of branch stock without a USID (not reserved for received units).
    const stock = await tx.stockItem.findUnique({ where: { branchId_itemId: { branchId: kase.branchId, itemId: opts.itemId } }, select: { quantity: true } });
    const held = await tx.stockUnit.count({ where: { branchId: kase.branchId, itemId: opts.itemId, status: "RECEIVED" } });
    if (!stock || stock.quantity - held <= 0) return { ok: false as const, message: "Out of stock." };
    await tx.stockItem.update({ where: { branchId_itemId: { branchId: kase.branchId, itemId: opts.itemId } }, data: { quantity: { decrement: 1 }, updatedById: opts.userId } });
    await tx.caseItemUsage.create({ data: { caseId: opts.caseId, itemId: opts.itemId, kind: "CONSUMED", userId: opts.userId } });
    return { ok: true as const, message: "Stock updated.", detail: `${item.name} used from branch stock (no USID) on ${kase.jobsheetNo}` };
  });
  if (!result.ok) return result;

  await logActivity({ action: "case.part.consume", userId: opts.userId, entity: "Case", entityId: opts.caseId, detail: result.detail });
  return { ok: true, message: result.message };
}

/**
 * Returns a received part to Head Office before the case closes. The reason is mandatory, with remarks.
 * - Unused: back to Head Office stock (available again).
 * - Courier / Branch damage: the USID goes to the Purchase Returns tab; a Replacement / Reorder request is raised so the
 *   Purchase Head can arrange a new purchase, bill it and transfer the new unit to the branch.
 * - Defective / Not working: a Vendor Replacement is created. The vendor replaces the unit and the same USID is reused: no new
 *   purchase and no new stock entry. It can be transferred to the branch before the defective unit reaches Head Office.
 * Branch stock drops by one in every case, the USID keeps its full history, and everything is written to the activity log.
 */
export async function returnCasePart(opts: {
  caseId: string;
  itemId: string;
  reason: ReturnReason;
  remarks: string;
  userId: string;
}): Promise<ActionResult> {
  const kase = await db.case.findUnique({ where: { id: opts.caseId }, select: { jobsheetNo: true, status: true, branchId: true } });
  if (!kase || kase.status === "CLOSED" || kase.status === "CANCELLED") return { ok: false, message: "Items can only be returned before the case is closed." };
  const ho = await getHeadOfficeBranch();
  const unused = opts.reason === "UNUSED";
  const label = RETURN_REASON_LABELS[opts.reason];
  const now = new Date();

  const result = await db.$transaction(async (tx) => {
    const unit = await tx.stockUnit.findFirst({
      where: { allocatedCaseId: opts.caseId, itemId: opts.itemId, status: "RECEIVED" },
      select: { id: true, usid: true, branchId: true, item: { select: { name: true } } },
    });
    if (!unit) return null;
    const claimed = await tx.stockUnit.updateMany({
      where: { id: unit.id, status: "RECEIVED" },
      data: unused
        ? {
            status: "AVAILABLE",
            branchId: ho.id,
            allocatedAt: null,
            allocatedById: null,
            allocatedCaseId: null,
            allocatedBranchId: null,
            purchaseRequestId: null,
            receivedAt: null,
            receivedById: null,
            note: `Returned unused from ${kase.jobsheetNo}`,
          }
        : {
            // Keeps its case and request links, so the Purchase Returns tab can show where it came from.
            status: opts.reason === "COURIER_DAMAGE" ? "RETURNED" : "AWAITING_VENDOR",
            branchId: ho.id,
            returnType: opts.reason,
            returnRemarks: opts.remarks,
            returnedAt: now,
            returnedById: opts.userId,
            note: `Returned from ${kase.jobsheetNo}: ${label}`,
          },
    });
    if (claimed.count === 0) return null;
    await tx.stockUnitEvent.create({
      data: { unitId: unit.id, action: "RETURNED", userId: opts.userId, caseId: opts.caseId, branchId: unit.branchId, note: `${label} — ${opts.remarks}` },
    });
    // Branch stock drops; Head Office stock rises only when the unit can be allocated again.
    await tx.stockItem.updateMany({ where: { branchId: unit.branchId, itemId: opts.itemId, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 }, updatedById: opts.userId } });
    if (unused) {
      await tx.stockItem.upsert({
        where: { branchId_itemId: { branchId: ho.id, itemId: opts.itemId } },
        create: { branchId: ho.id, itemId: opts.itemId, quantity: 1, unitCodes: [], updatedById: opts.userId },
        update: { quantity: { increment: 1 }, updatedById: opts.userId },
      });
    }
    await tx.caseItemUsage.create({
      data: {
        caseId: opts.caseId,
        itemId: opts.itemId,
        kind: unused ? "RETURNED_UNUSED" : "RETURNED_DEFECTIVE",
        stockUnitId: unit.id,
        reason: label,
        remarks: opts.remarks,
        userId: opts.userId,
      },
    });
    // Defective: the vendor replaces this USID (same USID, no new purchase or stock entry).
    const vendor =
      opts.reason === "DEFECTIVE"
        ? await createVendorReplacement(tx, { unitId: unit.id, caseId: opts.caseId, branchId: kase.branchId, itemId: opts.itemId, remarks: opts.remarks, userId: opts.userId })
        : null;
    return { ...unit, vendor };
  });
  if (!result) return { ok: false, message: "There is no received, unused unit of this item for the case." };

  await logActivity({
    action: "case.part.return",
    userId: opts.userId,
    entity: "Case",
    entityId: opts.caseId,
    detail: `${result.item.name} (${result.usid}) returned from ${kase.jobsheetNo}: ${label} — ${opts.remarks}`,
  });

  if (unused) return { ok: true, message: `${result.usid} returned to Head Office stock.` };

  if (result.vendor) {
    await logActivity({
      action: "inventory.vendor-replacement.request",
      userId: opts.userId,
      entity: "VendorReplacement",
      entityId: result.vendor.id,
      detail: `${result.vendor.code}: vendor replacement requested for ${result.usid} returned from ${kase.jobsheetNo} (${opts.remarks}). The same USID will be reused.`,
    });
    return { ok: true, message: `${result.usid} returned. Vendor replacement ${result.vendor.code} has been requested; the same USID will be reused.` };
  }

  // Courier / branch damage: a replacement still has to reach the customer, so a Replacement / Reorder request goes to the Purchase Head.
  const reorder = await createReplacementRequest({
    caseId: opts.caseId,
    itemId: opts.itemId,
    reason: `${label} (${result.usid}): ${opts.remarks}`,
    userId: opts.userId,
  });
  return {
    ok: true,
    message: `${result.usid} returned. It is in the Purchase Returns tab${reorder.ok ? " and a replacement has been requested." : "."}`,
  };
}

/**
 * Head Office confirms the returned unit has arrived. This is only a confirmation: the replacement can be bought, billed and
 * transferred to the branch without waiting for it, and it does not change the unit's status or any stock count.
 */
export async function receiveReturnedUnit(unitId: string, userId: string): Promise<ActionResult> {
  const result = await db.$transaction(async (tx) => {
    const unit = await tx.stockUnit.findUnique({ where: { id: unitId }, select: { usid: true, status: true, returnReceivedAt: true, allocatedCaseId: true, allocatedCase: { select: { jobsheetNo: true } } } });
    if (!unit || unit.status !== "RETURNED" || unit.returnReceivedAt) return null;
    const claimed = await tx.stockUnit.updateMany({
      where: { id: unitId, returnReceivedAt: null, status: "RETURNED" },
      data: { returnReceivedAt: new Date(), returnReceivedById: userId },
    });
    if (claimed.count === 0) return null;
    await tx.stockUnitEvent.create({ data: { unitId, action: "RETURNED", userId, caseId: unit.allocatedCaseId, note: "Returned unit received at Head Office" } });
    return unit;
  });
  if (!result) return { ok: false, message: "This returned unit was already received." };
  await logActivity({
    action: "inventory.return-received",
    userId,
    entity: "StockUnit",
    entityId: unitId,
    detail: `Returned unit ${result.usid} received at Head Office${result.allocatedCase ? ` (from ${result.allocatedCase.jobsheetNo})` : ""}`,
  });
  return { ok: true, message: `${result.usid} received at Head Office.` };
}

