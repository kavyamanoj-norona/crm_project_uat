"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { FieldError } from "@/server/prisma-errors";
import { logActivity } from "@/server/security/activity";
import { initialFormState, pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import {
  nonRepairableSchema,
  labOutsourceSchema,
  labItemsSchema,
  labWorkTypeSchema,
  vendorPaymentSchema,
  type CaseStatusValue,
  canRequestParts,
  LAB_ADD_ITEM_STATUSES,
} from "../case-schema";
import { SERVICE_PATHS } from "../paths";
import { qcBlockReason } from "../qc-response-queries";
import { nextSequence } from "@/server/sequence";
import { createReplacementRequest } from "@/modules/inventory/replacement";
import { consumeCasePart, parseReturn, qcConsumptionBlock, returnCasePart } from "@/modules/inventory/case-parts";

const STALE = "Someone else changed this case just now. Refresh to see its current stage.";

const LAB_STATUSES: CaseStatusValue[] = [
  "CHIP_TRANSFER",
  "CHIP_LAB_RECEIVED",
  "CHIP_LAB_DIAGNOSIS",
  "CHIP_LAB_PENDING_APPROVAL",
  "CHIP_LAB_SERVICING",
  "CHIP_LAB_READY_DISPATCH",
  "CHIP_LAB_QUALITY_CHECK",
  "NON_REPAIRABLE",
];

/**
 * Lab-side status transition. No branch scope — the lab handles cases from any
 * branch. Permission is gated by SERVICE_PATHS.lab (CHIP_COORDINATOR only).
 */
async function applyLabStage(
  caseId: string,
  from: CaseStatusValue,
  to: CaseStatusValue,
  note: string | null,
  userId: string,
) {
  const moved = await db.$transaction(async (tx) => {
    const { count } = await tx.case.updateMany({
      where: { id: caseId, status: from },
      data: {
        status: to,
        stageChangedAt: new Date(),
        updatedById: userId,
        // Transferring to the branch also completes the lab's work: there is no separate completion step.
        ...(to === "CHIP_BRANCH_RECEIVED" ? { labTransferCompletedAt: new Date(), labTransferCompletedById: userId } : {}),
      },
    });
    if (count === 0) return false;
    await tx.caseStatusHistory.create({
      data: { caseId, fromStatus: from, toStatus: to, note, changedById: userId },
    });
    return true;
  });
  if (moved) {
    await logActivity({
      action: "case.stage",
      userId,
      entity: "Case",
      entityId: caseId,
      detail: `${from} → ${to}${note ? `: ${note}` : ""}`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath(SERVICE_PATHS.cases, "layout");
  }
  return moved;
}

async function findLabCase(caseId: string) {
  return db.case.findFirst({
    where: { id: caseId, status: { in: LAB_STATUSES } },
    select: { status: true },
  });
}

// ── Lab workflow actions ───────────────────────────────────────────────────────

/** Lab accepts an incoming case: CHIP_TRANSFER → CHIP_LAB_RECEIVED */
export async function acceptLabIncoming(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { ok: false, message: "Case not found in lab queue." };
    if (row.status !== "CHIP_TRANSFER") return { ok: false, message: "Case is not in the incoming queue." };
    if (!(await applyLabStage(caseId, "CHIP_TRANSFER", "CHIP_LAB_RECEIVED", null, user.id)))
      return { ok: false, message: STALE };
    return { ok: true, message: "Case received by lab." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Lab starts diagnosis: CHIP_LAB_RECEIVED → CHIP_LAB_DIAGNOSIS */
export async function startLabDiagnosis(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { ok: false, message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_RECEIVED") return { ok: false, message: "Case must be in Lab Received stage." };
    if (!(await applyLabStage(caseId, "CHIP_LAB_RECEIVED", "CHIP_LAB_DIAGNOSIS", null, user.id)))
      return { ok: false, message: STALE };
    return { ok: true, message: "Lab diagnosis started." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Lab submits diagnosis, awaiting customer approval: CHIP_LAB_DIAGNOSIS → CHIP_LAB_PENDING_APPROVAL */
export async function setLabPendingApproval(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const note = formData.get("note")?.toString()?.trim() || null;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await db.case.findFirst({
      where: { id: caseId, status: { in: LAB_STATUSES } },
      select: { status: true, labWorkType: true },
    });
    if (!row) return { message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_DIAGNOSIS") return { message: "Case must be in Lab Diagnosis stage." };
    if (!row.labWorkType)
      return { message: "Set the work type (Inhouse or Outsource) before moving to Pending Approval." };
    if (!(await applyLabStage(caseId, "CHIP_LAB_DIAGNOSIS", "CHIP_LAB_PENDING_APPROVAL", note, user.id)))
      return { message: STALE };
    return { ok: true, message: "Moved to Pending Customer Approval." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Customer approved; lab starts servicing: CHIP_LAB_PENDING_APPROVAL → CHIP_LAB_SERVICING */
export async function startLabServicing(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { ok: false, message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_PENDING_APPROVAL") return { ok: false, message: "Case must be in Pending Approval stage." };
    if (!(await applyLabStage(caseId, "CHIP_LAB_PENDING_APPROVAL", "CHIP_LAB_SERVICING", null, user.id)))
      return { ok: false, message: STALE };
    return { ok: true, message: "Lab servicing started." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Lab marks case ready to dispatch: CHIP_LAB_SERVICING → CHIP_LAB_READY_DISPATCH */
export async function markLabReadyToDispatch(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { ok: false, message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_SERVICING") return { ok: false, message: "Case must be in In Servicing stage." };
    if (!(await applyLabStage(caseId, "CHIP_LAB_SERVICING", "CHIP_LAB_READY_DISPATCH", null, user.id)))
      return { ok: false, message: STALE };
    return { ok: true, message: "Marked as Ready to Dispatch." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Lab sends case to quality check: CHIP_LAB_READY_DISPATCH → CHIP_LAB_QUALITY_CHECK */
export async function startLabQualityCheck(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { ok: false, message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_READY_DISPATCH") return { ok: false, message: "Case must be in Ready to Dispatch stage." };
    // Quality check only once every part on the case has been consumed (or returned unused).
    const pending = await qcConsumptionBlock(caseId);
    if (pending) return { ok: false, message: pending };
    if (!(await applyLabStage(caseId, "CHIP_LAB_READY_DISPATCH", "CHIP_LAB_QUALITY_CHECK", null, user.id)))
      return { ok: false, message: STALE };
    return { ok: true, message: "Moved to Quality Check." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Lab marks case non-repairable (requires reason): CHIP_LAB_SERVICING → NON_REPAIRABLE */
export async function markNonRepairable(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = nonRepairableSchema.safeParse(pick(formData, ["reason"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_SERVICING") return { message: "Case must be in In Servicing stage." };
    if (!(await applyLabStage(caseId, "CHIP_LAB_SERVICING", "NON_REPAIRABLE", parsed.data.reason, user.id)))
      return { message: STALE };
    return { ok: true, message: "Case marked as Non-Repairable." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Lab dispatches case back to branch: CHIP_LAB_QUALITY_CHECK or NON_REPAIRABLE → CHIP_BRANCH_RECEIVED */
export async function dispatchToBranch(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const note = formData.get("note")?.toString()?.trim() || null;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { message: "Case not found in lab queue." };
    if (row.status !== "CHIP_LAB_QUALITY_CHECK" && row.status !== "NON_REPAIRABLE")
      return { message: "Case must pass Quality Check or be Non-Repairable to dispatch." };
    if (row.status === "CHIP_LAB_QUALITY_CHECK") {
      const blocked = await qcBlockReason(caseId, "CHIP_LAB_QUALITY_CHECK");
      if (blocked) return { message: blocked };
    }
    if (!(await applyLabStage(caseId, row.status as CaseStatusValue, "CHIP_BRANCH_RECEIVED", note, user.id)))
      return { message: STALE };
    return { ok: true, message: "Case transferred to the branch." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/**
 * "Transfer to Branch" once the quality check is complete: one action that sends the case back to its branch and
 * completes the lab's work (the QC notes are already on the timeline). Repeating it is rejected: the case has left the lab.
 */
export async function transferToBranch(caseId: string): Promise<ActionResult> {
  const res = await dispatchToBranch(caseId, initialFormState, new FormData());
  return { ok: Boolean(res.ok), message: res.message ?? (res.ok ? "Case transferred to the branch." : "Could not transfer the case.") };
}

// ── Outsourcing ───────────────────────────────────────────────────────────────

/** Records a vendor outsource for the current lab case (does not change status). */
export async function outsourceLabCase(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = labOutsourceSchema.safeParse(
    pick(formData, ["vendorId", "sentAt", "expectedReturnAt", "referenceNo", "notes"]),
  );
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const row = await findLabCase(caseId);
    if (!row) return { message: "Case not found in lab queue." };
    const { vendorId, sentAt, expectedReturnAt, referenceNo, notes } = parsed.data;
    await db.chipLabOutsource.create({
      data: {
        caseId,
        vendorId,
        sentAt: new Date(sentAt),
        expectedReturnAt: expectedReturnAt ? new Date(expectedReturnAt) : null,
        referenceNo: referenceNo ?? null,
        notes: notes ?? null,
        createdById: user.id,
      },
    });
    await logActivity({
      action: "case.lab.outsource",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Outsourced to vendor (id: ${vendorId})`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: "Outsource recorded." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Marks the actual return date on an outsource record (vendor returned the device). */
export async function markOutsourceReturned(outsourceId: string): Promise<ActionResult> {
  try {
    await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    await db.chipLabOutsource.update({
      where: { id: outsourceId },
      data: { actualReturnAt: new Date() },
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: "Return date recorded." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

// ── Lab work type ─────────────────────────────────────────────────────────────

/**
 * Save the work type (INHOUSE or OUTSOURCE) and the associated engineer or
 * vendor during CHIP_LAB_DIAGNOSIS. Clears the opposite FK automatically.
 */
export async function saveLabWorkType(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = labWorkTypeSchema.safeParse(pick(formData, ["workType", "engineerId", "vendorId"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { workType, engineerId, vendorId } = parsed.data;

  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const who = { select: { firstName: true, lastName: true } } as const;
    const c = await db.case.findFirst({
      where: { id: caseId, status: "CHIP_LAB_DIAGNOSIS" },
      select: { status: true, labWorkType: true, labEngineer: who, labVendor: { select: { name: true } } },
    });
    if (!c) return { message: "Case not found in lab diagnosis stage." };

    const [newEngineer, newVendor] = await Promise.all([
      workType === "INHOUSE" && engineerId ? db.user.findUnique({ where: { id: engineerId }, ...who }) : null,
      workType === "OUTSOURCE" && vendorId ? db.chipLabVendor.findUnique({ where: { id: vendorId }, select: { name: true } }) : null,
    ]);
    const describe = (type: string | null, engineer: string | null, vendor: string | null) =>
      !type ? "not set" : type === "INHOUSE" ? `Inhouse${engineer ? ` — ${engineer}` : ""}` : `Outsource${vendor ? ` — ${vendor}` : ""}`;
    const fullName = (u: { firstName: string; lastName: string | null } | null) =>
      u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : null;
    const was = describe(c.labWorkType, fullName(c.labEngineer), c.labVendor?.name ?? null);
    const now = describe(workType, fullName(newEngineer), newVendor?.name ?? null);

    await db.case.update({
      where: { id: caseId },
      data: {
        labWorkType: workType,
        labEngineerId: workType === "INHOUSE" ? (engineerId ?? null) : null,
        labVendorId: workType === "OUTSOURCE" ? (vendorId ?? null) : null,
        updatedById: user.id,
      },
    });

    await logActivity({
      action: "case.lab.worktype",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Work type: ${now} (was: ${was})`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: `Work type saved — ${workType === "INHOUSE" ? "Inhouse" : "Outsource"}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

// ── Lab items ─────────────────────────────────────────────────────────────────

/**
 * Save billable items for a chip-level lab case. No branch scope — lab handles
 * cases from any branch. Items use the append-only pattern (retire old, insert
 * new). Editable at any active lab stage (not once dispatched back to branch).
 */
export async function saveLabItems(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = labItemsSchema.safeParse(pick(formData, ["items"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;

  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const c = await db.case.findFirst({
      where: { id: caseId, status: { in: LAB_STATUSES } },
      select: { status: true, labWorkType: true, items: { where: { removedAt: null }, select: { itemId: true } } },
    });
    if (!c) return { message: "Case is no longer in the lab." };
    const outsourced = c.labWorkType === "OUTSOURCE";

    // Items already on the case may include ones removed from the catalog since.
    const kept = new Set(c.items.map((i) => i.itemId));
    const catalog = new Map(
      (await db.item.findMany({ where: { id: { in: data.items.map((l) => l.itemId) } } })).map((i) => [i.id, i]),
    );
    const lines = data.items.map((l, i) => {
      const item = catalog.get(l.itemId);
      if (!item || (!item.isActive && !kept.has(item.id)))
        throw new FieldError("items", "An item is no longer available — remove it and pick again");
      const min = minPricePaise(item.pricePaise, item.maxDiscountPercent);
      const unit = l.unitPrice!;
      if (unit < min)
        throw new FieldError("items", `${item.name}: lowest allowed price is ${formatPaise(min)} (max ${item.maxDiscountPercent}% discount)`);
      if (unit > item.pricePaise)
        throw new FieldError("items", `${item.name}: price can't be above ${formatPaise(item.pricePaise)}`);
      // Outsourced services are paid to the vendor per unit, so every service line needs its vendor charge.
      if (outsourced && item.type === "SERVICE" && (l.vendorCost === null || l.vendorCost <= 0))
        throw new FieldError(`vendorCost-${item.id}`, "Enter the vendor charge");
      return {
        caseId,
        itemId: item.id,
        code: item.code,
        name: item.name,
        type: item.type,
        quantity: l.quantity,
        listPricePaise: item.pricePaise,
        minPricePaise: min,
        unitPricePaise: unit,
        gstPercent: item.gstPercent,
        lineTotalPaise: unit * l.quantity,
        vendorCostPaise: outsourced ? l.vendorCost : null,
        sortOrder: i,
        addedById: user.id,
      };
    });
    const total = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
    const now = new Date();

    const saved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status },
        data: { estimatedCostPaise: lines.length ? total : null, updatedById: user.id },
      });
      if (count === 0) return false;
      await tx.caseItem.updateMany({ where: { caseId, removedAt: null }, data: { removedAt: now, removedById: user.id } });
      if (lines.length) await tx.caseItem.createMany({ data: lines });
      return true;
    });
    if (!saved) return { message: STALE };

    await logActivity({
      action: "case.estimate",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Lab items updated: ${lines.length} ${lines.length === 1 ? "item" : "items"}, ${formatPaise(total)}`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: `Items saved · ${formatPaise(total)}` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field.startsWith("vendorCost-") ? e.field : "items"]: [e.message] } };
    throw e;
  }
}

// ── Lab stock: request / consume parts ────────────────────────────────────────

/**
 * The branch a request or stock use is tracked against: the requester's own
 * branch (e.g. Head Office). Falls back to the case's branch for an account
 * that isn't tied to one.
 */
async function requesterBranch(userBranchId: string | null, caseId: string) {
  const id = userBranchId ?? (await db.case.findUnique({ where: { id: caseId }, select: { branchId: true } }))?.branchId;
  return id ? db.branch.findUnique({ where: { id }, select: { id: true, code: true } }) : null;
}

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () =>
  periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

async function physicalLine(caseItemId: string) {
  const line = await db.caseItem.findFirst({
    where: { id: caseItemId, removedAt: null, case: { status: { in: LAB_STATUSES } } },
    select: { itemId: true, quantity: true, caseId: true, type: true },
  });
  return line && (line.type === "PART" || line.type === "ACCESSORY") ? line : null;
}

/** Raises a purchase request, tracked against the requester's branch, for one billable part. */
export async function requestPartForLabCase(caseItemId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const line = await physicalLine(caseItemId);
    if (!line) return { ok: false, message: "Only parts and accessories can be requested." };
    const lab = await requesterBranch(user.branchId, line.caseId);
    if (!lab) return { ok: false, message: "Your account has no branch to raise the request for." };
    const stage = await db.case.findUnique({ where: { id: line.caseId }, select: { status: true } });
    if (!stage || !canRequestParts(stage.status as CaseStatusValue)) return { ok: false, message: "Parts can be requested once the approval is complete." };

    const open = await db.purchaseRequest.findFirst({
      where: { caseId: line.caseId, itemId: line.itemId, status: { notIn: ["FULFILLED", "REJECTED"] } },
      select: { id: true },
    });
    if (open) return { ok: false, message: "This item is already requested." };

    await db.$transaction(async (tx) => {
      const seq = await nextSequence(tx, `PR:${lab.code}:${period()}`);
      const code = `PR-${lab.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
      await tx.purchaseRequest.create({
        data: { code, branchId: lab.id, itemId: line.itemId, quantity: 1, caseId: line.caseId, requestedById: user.id },
      });
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true, message: "Item requested." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Reorder a part for a lab case because the unit already received is defective (confirmed with a reason). */
export async function reorderPartForLabCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const reason = String(formData.get("reason") ?? "").trim();
  if (reason.length < 5) return { message: "Please fix the highlighted fields.", fieldErrors: { reason: ["Explain why it needs to be reordered"] } };
  if (reason.length > 300) return { message: "Please fix the highlighted fields.", fieldErrors: { reason: ["Keep the reason under 300 characters"] } };
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const line = await physicalLine(caseItemId);
    if (!line) return { message: "Only parts and accessories can be reordered." };
    const res = await createReplacementRequest({ caseId: line.caseId, itemId: line.itemId, reason, userId: user.id });
    if (!res.ok) return { message: res.message };
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/**
 * Uses a part for this case. The chip-level lab works at Head Office, so the unit must be in Head Office stock
 * (checked by location), whichever branch the case came from. Its USID becomes Consumed; this is what lets the case
 * move on to Quality check.
 */
export async function consumeLabItem(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const unitId = String(formData.get("unitId") ?? "");
  if (!unitId) return { message: "Please fix the highlighted fields.", fieldErrors: { unitId: ["Select the USID to consume"] } };
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const line = await physicalLine(caseItemId);
    if (!line) return { message: "Item or stock not found." };
    // Head Office stock only, whichever branch the case came from.
    const res = await consumeCasePart({ caseId: line.caseId, itemId: line.itemId, unitId, userId: user.id, atHeadOffice: true });
    if (!res.ok) return { message: res.message };
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Return a received part from a lab case to Head Office (unused or defective), with a reason and remarks. */
export async function returnPartForLabCase(caseItemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseReturn(formData);
  if ("error" in parsed) return parsed.error;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const line = await physicalLine(caseItemId);
    if (!line) return { message: "Item not found." };
    const res = await returnCasePart({ caseId: line.caseId, itemId: line.itemId, reason: parsed.reason, remarks: parsed.remarks, photos: parsed.photos, userId: user.id });
    if (!res.ok) return { message: res.message };
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true, message: res.message };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/**
 * Adds one item to a lab case at any active stage. Outside lab diagnosis the case goes back to Lab Diagnosis,
 * so the customer approves the new estimate before servicing continues.
 */
export async function addItemToLabCase(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return { message: "Please fix the highlighted fields.", fieldErrors: { itemId: ["Select an item"] } };
  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const c = await db.case.findFirst({
      where: { id: caseId, status: { in: LAB_ADD_ITEM_STATUSES } },
      select: { status: true, jobsheetNo: true, items: { where: { removedAt: null }, select: { itemId: true, lineTotalPaise: true, sortOrder: true } } },
    });
    if (!c) return { message: "Items can't be added at this stage." };
    if (c.items.some((i) => i.itemId === itemId)) return { message: "This item is already on the case.", fieldErrors: { itemId: ["Already on this case"] } };
    const item = await db.item.findFirst({ where: { id: itemId, isActive: true } });
    if (!item) return { message: "Item not found.", fieldErrors: { itemId: ["Select an item"] } };

    const min = minPricePaise(item.pricePaise, item.maxDiscountPercent);
    const backToDiagnosis = c.status !== "CHIP_LAB_DIAGNOSIS";
    const total = c.items.reduce((sum, i) => sum + i.lineTotalPaise, 0) + item.pricePaise;
    const now = new Date();

    const done = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status },
        data: { estimatedCostPaise: total, updatedById: user.id, ...(backToDiagnosis ? { status: "CHIP_LAB_DIAGNOSIS", stageChangedAt: now } : {}) },
      });
      if (count === 0) return false;
      await tx.caseItem.create({
        data: {
          caseId,
          itemId: item.id,
          code: item.code,
          name: item.name,
          type: item.type,
          quantity: 1,
          listPricePaise: item.pricePaise,
          minPricePaise: min,
          unitPricePaise: item.pricePaise,
          gstPercent: item.gstPercent,
          lineTotalPaise: item.pricePaise,
          sortOrder: Math.max(-1, ...c.items.map((i) => i.sortOrder)) + 1,
          addedById: user.id,
        },
      });
      if (backToDiagnosis) {
        await tx.caseStatusHistory.create({
          data: { caseId, fromStatus: c.status, toStatus: "CHIP_LAB_DIAGNOSIS", note: `Item added: ${item.name}. Back to lab diagnosis for customer approval.`, changedById: user.id, at: now },
        });
      }
      return true;
    });
    if (!done) return { message: STALE };

    await logActivity({
      action: "case.item.add",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `${item.name} added to ${c.jobsheetNo}${backToDiagnosis ? ` (${c.status} → CHIP_LAB_DIAGNOSIS, needs customer approval)` : ""}`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: backToDiagnosis ? "Item added. The case is back in Lab Diagnosis for customer approval." : "Item added." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

// ── Vendor payments ───────────────────────────────────────────────────────────

/** Records money paid to the outsource vendor for this case. Cannot exceed what is still due. */
export async function recordVendorPayment(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = vendorPaymentSchema.safeParse(pick(formData, ["amount", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { amount, note } = parsed.data;

  try {
    const user = await requireActionPermission(SERVICE_PATHS.lab, "canEdit");
    const c = await db.case.findFirst({
      where: { id: caseId, labWorkType: "OUTSOURCE" },
      select: {
        items: { where: { removedAt: null }, select: { quantity: true, vendorCostPaise: true } },
        labVendorPayments: { select: { amountPaise: true } },
      },
    });
    if (!c) return { message: "This case isn't outsourced." };

    const owed = c.items.reduce((s, i) => s + (i.vendorCostPaise ?? 0) * i.quantity, 0);
    const paid = c.labVendorPayments.reduce((s, p) => s + p.amountPaise, 0);
    const due = owed - paid;
    if (due <= 0) return { message: "Nothing is due to the vendor." };
    if (amount! > due) return { message: `Can't pay more than the ${formatPaise(due)} due.`, fieldErrors: { amount: [`Maximum ${formatPaise(due)}`] } };

    await db.chipLabVendorPayment.create({ data: { caseId, amountPaise: amount!, note, paidById: user.id } });
    await logActivity({
      action: "case.lab.vendor-payment",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Paid vendor ${formatPaise(amount!)}`,
    });
    revalidatePath(SERVICE_PATHS.lab, "layout");
    return { ok: true, message: `Payment of ${formatPaise(amount!)} recorded.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
