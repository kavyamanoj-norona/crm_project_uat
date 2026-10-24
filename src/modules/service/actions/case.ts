"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { decryptText } from "@/server/crypto";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { casePath, labCasePath, notify } from "@/server/notify/push";
import { sendQuoteNotification } from "@/server/notify/customer";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import type { CurrentUser } from "@/server/auth/session";
import type { RevealResult } from "@/components/ui/secret-reveal";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { qcBlockReason } from "../qc-response-queries";
import { billingBlockReason, cameFromChipLab } from "../billing-guard";
import { approvalBlockReason, pendingApproval } from "../approval-guard";
import {
  CASE_FLOW,
  CASE_STATUS_LABELS,
  BILLING_EDIT_STATUSES,
  ESTIMATE_EDITABLE,
  cancelSchema,
  chipHandoffSchema,
  estimateSchema,
  feedbackSchema,
  isOpenStatus,
  ADD_ITEM_STATUSES,
  nextStage,
  stageChangeSchema,
  transferToChipSchema,
  type CaseStatusValue,
} from "../case-schema";
import { SERVICE_PATHS } from "../paths";
import { listBranchStaff } from "../queries";
import { markCaseUnitsConsumed } from "@/modules/inventory/unit-consume";
import { qcConsumptionBlock } from "@/modules/inventory/case-parts";
import { postCasePayment } from "@/modules/finance/posting";

const STALE = "Someone else changed this case just now. Refresh to see its current stage.";

/**
 * Moves a case from `from` to `to` and writes the timeline entry. The update
 * only matches while the case is still in `from` (and in the user's branch
 * scope), so two people clicking at once can't both move it.
 */
async function applyStage(caseId: string, from: CaseStatusValue, to: CaseStatusValue, note: string | null, userId: string, scope: { branchId?: string }) {
  const moved = await db.$transaction(async (tx) => {
    // Handing a case to the chip-level lab fixes the total the lab's estimate is compared with.
    const baseline = to === "CHIP_TRANSFER" ? (await tx.case.findUnique({ where: { id: caseId }, select: { estimatedCostPaise: true } }))?.estimatedCostPaise ?? null : undefined;
    const { count } = await tx.case.updateMany({
      where: { id: caseId, status: from, ...scope },
      data: { status: to, stageChangedAt: new Date(), updatedById: userId, ...(baseline !== undefined ? { chipBaselinePaise: baseline } : {}) },
    });
    if (count === 0) return false;
    await tx.caseStatusHistory.create({ data: { caseId, fromStatus: from, toStatus: to, note, changedById: userId } });
    // Spare parts received for this case are consumed once it is closed.
    if (to === "CLOSED") await markCaseUnitsConsumed(tx, caseId, userId);
    return true;
  });
  if (moved) {
    await logActivity({ action: "case.stage", userId, entity: "Case", entityId: caseId, detail: `${from} → ${to}${note ? `: ${note}` : ""}` });
    // A case arriving in the chip-level lab queue: the Chip Level Coordinator picks it up.
    if (to === "CHIP_TRANSFER") {
      const c = await db.case.findUnique({ where: { id: caseId }, select: { jobsheetNo: true, chipDeadRisk: true } });
      if (c)
        notify(
          { privileges: ["CHIP_COORDINATOR"], exceptUserId: userId },
          { category: "SERVICE", title: "New case for the chip-level lab", body: `${c.jobsheetNo}${c.chipDeadRisk ? " · dead risk" : ""} is waiting in the incoming queue`, url: labCasePath(caseId), tag: `lab-incoming-${caseId}` },
        );
    }
    revalidatePath(SERVICE_PATHS.cases, "layout");
  }
  return moved;
}

/** Loads the case inside the user's branch scope (null = not found / other branch). */
async function scopedCase(caseId: string, user: CurrentUser) {
  const scope = branchWhere(await getBranchScope(user));
  const row = await db.case.findFirst({ where: { id: caseId, ...scope }, select: { status: true, chipMaxEstimatePaise: true, chipCustomerApprovedAt: true } });
  return { row, scope };
}

/** "Move to <next stage> →" button. */
export async function moveCaseToNextStage(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { ok: false, message: "Case not found." };
    if (row.status === "INTAKE") return { ok: false, message: "Use Start diagnosis to assign an engineer and add items." };
    const to = nextStage(row.status);
    if (!to) return { ok: false, message: "This case has no next stage." };
    if (row.status === "PENDING_APPROVAL") {
      const held = await approvalBlockReason(caseId);
      if (held) return { ok: false, message: held };
    }
    if (row.status === "QUALITY_CHECK") {
      const blocked = await qcBlockReason(caseId, "QUALITY_CHECK");
      if (blocked) return { ok: false, message: blocked };
    }
    // The bill must be valid and saved before the case moves on.
    if (BILLING_EDIT_STATUSES.includes(row.status)) {
      const bill = await billingBlockReason(caseId);
      if (bill) return { ok: false, message: bill };
    }
    // A case is closed only through its final bill (invoice + payment), never by a plain stage move.
    if (to === "CLOSED") return { ok: false, message: "Use Move to Closed to generate the final bill and close the case." };
    // Quality check only once every part on the case has been consumed (or returned unused).
    if (to === "QUALITY_CHECK") {
      const pending = await qcConsumptionBlock(caseId);
      if (pending) return { ok: false, message: pending };
    }
    if (!(await applyStage(caseId, row.status, to, null, user.id, scope))) return { ok: false, message: STALE };
    return { ok: true, message: `Moved to ${CASE_STATUS_LABELS[to]}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/**
 * Adds one item to a case that is already past diagnosis (or still in it). The item is added at its list price. Outside
 * Diagnosis the case goes back to Diagnosis, so the customer approves the new estimate before servicing continues.
 */
export async function addItemToCase(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const itemId = String(formData.get("itemId") ?? "").trim();
  if (!itemId) return { message: "Please fix the highlighted fields.", fieldErrors: { itemId: ["Select an item"] } };
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, jobsheetNo: true, items: { where: { removedAt: null }, select: { itemId: true, lineTotalPaise: true, sortOrder: true } } },
    });
    if (!c) return { message: "Case not found." };
    if (!ADD_ITEM_STATUSES.includes(c.status)) return { message: "Items can't be added at this stage." };
    if (c.items.some((i) => i.itemId === itemId)) return { message: "This item is already on the case.", fieldErrors: { itemId: ["Already on this case"] } };
    const item = await db.item.findFirst({ where: { id: itemId, isActive: true } });
    if (!item) return { message: "Item not found.", fieldErrors: { itemId: ["Select an item"] } };

    const min = minPricePaise(item.pricePaise, item.maxDiscountPercent);
    const backToDiagnosis = c.status !== "DIAGNOSIS";
    const total = c.items.reduce((sum, i) => sum + i.lineTotalPaise, 0) + item.pricePaise;
    const now = new Date();

    const moved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status, ...scope },
        data: { estimatedCostPaise: total, updatedById: user.id, ...(backToDiagnosis ? { status: "DIAGNOSIS", stageChangedAt: now } : {}) },
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
          data: { caseId, fromStatus: c.status, toStatus: "DIAGNOSIS", note: `Item added: ${item.name}. Back to diagnosis for customer approval.`, changedById: user.id, at: now },
        });
      }
      return true;
    });
    if (!moved) return { message: STALE };

    await logActivity({
      action: "case.item.add",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `${item.name} added to ${c.jobsheetNo}${backToDiagnosis ? ` (${c.status} → DIAGNOSIS, needs customer approval)` : ""}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: backToDiagnosis ? "Item added. The case is back in Diagnosis for customer approval." : "Item added." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** "Change stage" dialog: any stage on the path (e.g. skip Awaiting stock or step back), with a note. */
export async function changeCaseStage(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = stageChangeSchema.safeParse(pick(formData, ["toStatus", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { message: "Case not found." };
    if (!isOpenStatus(row.status)) return { message: "Closed and cancelled cases can't change stage." };
    if (row.status === "INTAKE") return { message: "Use Start diagnosis to assign an engineer and add items." };
    const { toStatus, note } = parsed.data;
    if (toStatus === "CLOSED") return { message: "A case is closed with its final bill. Use Move to Closed.", fieldErrors: { toStatus: ["Use Move to Closed"] } };
    const qcIdx = CASE_FLOW.indexOf("QUALITY_CHECK");
    if (CASE_FLOW.indexOf(row.status) >= 0 && CASE_FLOW.indexOf(row.status) < qcIdx && CASE_FLOW.indexOf(toStatus) >= qcIdx) {
      const pending = await qcConsumptionBlock(caseId);
      if (pending) return { message: pending };
    }
    if (row.status === "PENDING_APPROVAL" && CASE_FLOW.indexOf(toStatus) > CASE_FLOW.indexOf(row.status)) {
      const held = await approvalBlockReason(caseId);
      if (held) return { message: held };
    }
    if (toStatus === row.status) return { message: "The case is already in that stage.", fieldErrors: { toStatus: ["Pick a different stage"] } };
    // Moving forward out of Quality Check needs the checklist; stepping back doesn't.
    if (row.status === "QUALITY_CHECK" && CASE_FLOW.indexOf(toStatus) > CASE_FLOW.indexOf("QUALITY_CHECK")) {
      const blocked = await qcBlockReason(caseId, "QUALITY_CHECK");
      if (blocked) return { message: blocked };
    }
    if (!(await applyStage(caseId, row.status, toStatus, note, user.id, scope))) return { message: STALE };
    return { ok: true, message: `Moved to ${CASE_STATUS_LABELS[toStatus]}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Cancels an open case. The reason goes on the timeline. */
export async function cancelCase(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = cancelSchema.safeParse(pick(formData, ["reason"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { message: "Case not found." };
    if (!isOpenStatus(row.status)) return { message: "This case is already closed or cancelled." };
    if (!(await applyStage(caseId, row.status, "CANCELLED", parsed.data.reason, user.id, scope))) return { message: STALE };
    return { ok: true, message: "Case cancelled." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Shows the device passcode of a case. Every reveal is written to the activity log. */
export async function revealDevicePassword(caseId: string): Promise<RevealResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canView");
    const row = await db.case.findFirst({
      where: { id: caseId, ...branchWhere(await getBranchScope(user)) },
      select: { devicePasswordEnc: true, jobsheetNo: true },
    });
    if (!row) return { ok: false, message: "Case not found." };
    if (!row.devicePasswordEnc) return { ok: false, message: "No passcode was recorded." };
    const value = decryptText(row.devicePasswordEnc);
    await logActivity({ action: "case.password-reveal", userId: user.id, entity: "Case", entityId: caseId, detail: row.jobsheetNo });
    return { ok: true, value };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/**
 * "Send quote to customer" — moves the case from Diagnosis to Pending approval
 * and fires the customer notification. Requires at least one billable item.
 */
export async function submitDiagnosis(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: {
        status: true,
        estimatedCostPaise: true,
        chipMaxEstimatePaise: true,
        jobsheetNo: true,
        brand: true,
        model: true,
        customer: { select: { name: true, phone: true } },
        branch: { select: { name: true } },
      },
    });
    if (!c) return { ok: false, message: "Case not found." };
    if (c.status !== "DIAGNOSIS") return { ok: false, message: "Only cases in Diagnosis can be submitted for approval." };
    // A chip-level case is quoted its maximum estimate; items aren't needed yet.
    const quoted = c.chipMaxEstimatePaise ?? c.estimatedCostPaise;
    if (!quoted) return { ok: false, message: "Add at least one item to the estimate before sending to the customer." };
    const bill = await billingBlockReason(caseId);
    if (bill) return { ok: false, message: bill };

    const moved = await applyStage(caseId, "DIAGNOSIS", "PENDING_APPROVAL", "Quote sent to customer", user.id, scope);
    if (!moved) return { ok: false, message: STALE };

    const notifyArgs = {
      customerName: c.customer.name,
      customerPhone: c.customer.phone,
      jobsheetNo: c.jobsheetNo,
      device: [c.brand, c.model].filter(Boolean).join(" "),
      estimatePaise: quoted,
      branchName: c.branch.name,
    };
    await sendQuoteNotification(notifyArgs);
    return { ok: true, message: "Quote sent — case moved to Pending approval. Open WhatsApp on the case page to notify the customer." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Save (create or update) feedback for a closed/cancelled case. */
export async function saveCaseFeedback(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = feedbackSchema.safeParse(pick(formData, ["rating", "comment", "customerBehaviour"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { message: "Case not found." };
    if (row.status !== "CLOSED" && row.status !== "CANCELLED")
      return { message: "Feedback can only be added to closed or cancelled cases." };
    await db.caseFeedback.upsert({
      where: { caseId },
      create: { caseId, ...parsed.data, createdById: user.id },
      update: { ...parsed.data },
    });
    await logActivity({ action: "case.feedback", userId: user.id, entity: "Case", entityId: caseId, detail: `Rating ${parsed.data.rating}/5` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Feedback saved." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

// ── Branch-side chip-level actions ───────────────────────────────────────────

/** Branch sends a case to the chip-level lab: DIAGNOSIS → CHIP_TRANSFER */
export async function transferToChipLab(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = transferToChipSchema.safeParse(pick(formData, ["note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { message: "Case not found." };
    // A chip-level case goes to the lab from Pending approval, once the customer has approved.
    const chipPlanned = row.chipMaxEstimatePaise !== null;
    if (chipPlanned) {
      if (row.status !== "PENDING_APPROVAL" || !row.chipCustomerApprovedAt)
        return { message: "Send the quote to the customer and record their approval before transferring to the chip-level lab." };
    } else return { message: "Send the maximum estimate to the customer for approval first (Send to Chip-Level Lab)." };
    if (!(await applyStage(caseId, row.status, "CHIP_TRANSFER", parsed.data.note ?? "Transferred to chip-level lab", user.id, scope)))
      return { message: "Someone else changed this case just now. Refresh to see its current stage." };
    return { ok: true, message: "Case transferred to chip-level lab." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Branch confirms receipt of a device back from the lab: CHIP_BRANCH_RECEIVED → QUALITY_CHECK */
export async function receiveFromChipLab(caseId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { ok: false, message: "Case not found." };
    if (row.status !== "CHIP_BRANCH_RECEIVED") return { ok: false, message: "Case has not been dispatched from the lab yet." };
    if (!(await applyStage(caseId, "CHIP_BRANCH_RECEIVED", "QUALITY_CHECK", "Device received from chip-level lab", user.id, scope)))
      return { ok: false, message: "Someone else changed this case just now. Refresh to see its current stage." };
    return { ok: true, message: "Device received — moved to Quality Check." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Branch fails QC and sends the device back to the lab: QUALITY_CHECK → CHIP_TRANSFER */
export async function sendBackToChipLab(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const note = formData.get("note")?.toString()?.trim() || null;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const { row, scope } = await scopedCase(caseId, user);
    if (!row) return { message: "Case not found." };
    if (row.status !== "QUALITY_CHECK") return { message: "Case must be in Quality Check to send back to the lab." };
    const beenToLab = (await db.caseStatusHistory.count({ where: { caseId, toStatus: "CHIP_TRANSFER" } })) > 0;
    // A first trip to the lab needs the customer's approval of the maximum estimate (requestChipApproval).
    if (!beenToLab) return { message: "Send the maximum estimate to the customer for approval before transferring to the chip-level lab." };
    const defaultNote = beenToLab ? "QC failed — sent back to chip-level lab" : "Issue found at quality check — sent to chip-level lab";
    if (!(await applyStage(caseId, "QUALITY_CHECK", "CHIP_TRANSFER", note ?? defaultNote, user.id, scope)))
      return { message: "Someone else changed this case just now. Refresh to see its current stage." };
    return { ok: true, message: beenToLab ? "Case sent back to chip-level lab." : "Case sent to chip-level lab." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/**
 * "Send to Chip-Level Lab" (Diagnosis or Quality check, before any lab trip): records the maximum estimate and dead
 * risk and sends them to the customer for approval. The case moves to Pending approval and stays with the branch;
 * Customer approved → Transfer to Chip-Level Lab then follow, the same as when chip-level is chosen at Start diagnosis.
 */
export async function requestChipApproval(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = chipHandoffSchema.safeParse(pick(formData, ["chipMaxEstimate", "chipDeadRisk", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { chipMaxEstimate, chipDeadRisk, note } = parsed.data;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, jobsheetNo: true, brand: true, model: true, estimatedCostPaise: true, customer: { select: { name: true, phone: true } }, branch: { select: { name: true } } },
    });
    if (!c) return { message: "Case not found." };
    if (c.status !== "DIAGNOSIS" && c.status !== "QUALITY_CHECK") return { message: "A case can be sent to the chip-level lab from Diagnosis or Quality Check." };
    if ((await db.caseStatusHistory.count({ where: { caseId, toStatus: "CHIP_TRANSFER" } })) > 0)
      return { message: "This case has already been to the chip-level lab. Use Send back to Chip-Level Lab." };
    const total = c.estimatedCostPaise ?? 0;
    if (chipMaxEstimate! < total)
      return { message: "Please fix the highlighted fields.", fieldErrors: { chipMaxEstimate: [`Maximum estimate can't be below the estimate total (${formatPaise(total)})`] } };

    const from = c.status;
    const now = new Date();
    const text = `Chip-level service — maximum estimate ${formatPaise(chipMaxEstimate!)}${chipDeadRisk ? ", dead risk" : ""} sent for customer approval${note ? `. ${note}` : ""}`;
    const moved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: from, ...scope },
        data: {
          status: "PENDING_APPROVAL",
          stageChangedAt: now,
          chipBaselinePaise: c.estimatedCostPaise,
          chipMaxEstimatePaise: chipMaxEstimate,
          chipDeadRisk,
          chipCustomerApprovedAt: null,
          updatedById: user.id,
        },
      });
      if (count === 0) return false;
      await tx.caseStatusHistory.create({ data: { caseId, fromStatus: from, toStatus: "PENDING_APPROVAL", note: text, changedById: user.id, at: now } });
      return true;
    });
    if (!moved) return { message: STALE };

    await sendQuoteNotification({
      customerName: c.customer.name,
      customerPhone: c.customer.phone,
      jobsheetNo: c.jobsheetNo,
      device: [c.brand, c.model].filter(Boolean).join(" "),
      estimatePaise: chipMaxEstimate!,
      branchName: c.branch.name,
    });
    await logActivity({ action: "case.stage", userId: user.id, entity: "Case", entityId: caseId, detail: `${from} → PENDING_APPROVAL: ${text}` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: `Sent for customer approval · maximum estimate ${formatPaise(chipMaxEstimate!)}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Quick-assign (or reassign) the engineer on any open case. */
export async function assignEngineer(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const engineerId = String(formData.get("engineerId") ?? "").trim();
  if (!engineerId) return { message: "Select an engineer.", fieldErrors: { engineerId: ["Select an engineer"] } };
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, branchId: true, jobsheetNo: true, engineerId: true },
    });
    if (!c) return { message: "Case not found." };
    if (!isOpenStatus(c.status)) return { message: "Cannot reassign engineer on a closed or cancelled case." };
    const engineer = await db.user.findUnique({
      where: { id: engineerId },
      select: { branchId: true, isActive: true, status: true, firstName: true, lastName: true },
    });
    if (!engineer?.isActive || engineer.status !== "WORKING" || engineer.branchId !== c.branchId)
      return { message: "Pick someone working in this branch.", fieldErrors: { engineerId: ["Must be an active staff member in this branch"] } };
    await db.case.update({ where: { id: caseId }, data: { engineerId, updatedById: user.id } });
    await logActivity({
      action: "case.engineer",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Assigned to ${[engineer.firstName, engineer.lastName].filter(Boolean).join(" ")}`,
    });
    if (engineerId !== c.engineerId)
      notify({ userIds: [engineerId], exceptUserId: user.id }, { category: "SERVICE", title: "Case assigned to you", body: `${c.jobsheetNo} was assigned to you`, url: casePath(caseId), tag: `assign-${caseId}` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Engineer assigned." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

/** Returns working branch staff for the assign-engineer dialog (lazy-load from the client). */
export async function getBranchStaffOptions(branchId: string): Promise<{ value: string; label: string }[]> {
  try {
    await requireActionPermission(SERVICE_PATHS.cases, "canView");
    return listBranchStaff(branchId);
  } catch {
    return [];
  }
}

const ESTIMATE_FIELDS = ["engineerId", "chipLevel", "chipMaxEstimate", "chipDeadRisk", "expectedDeliveryDate", "gstInvoiceRequired", "note", "items", "advanceAmount", "advanceMode"];

/**
 * "Start diagnosis" (mode start: Intake → Diagnosis) and "Edit items" (mode
 * edit, while in Diagnosis / Pending approval). Assigns the engineer, replaces
 * the billable lines and sets the estimate to their total. Prices are checked
 * against the catalog: never below the item's minimum.
 */
export async function saveEstimate(caseId: string, mode: "start" | "edit", _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = estimateSchema.safeParse(pick(formData, ESTIMATE_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;

  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, branchId: true, customerId: true, estimatedCostPaise: true, jobsheetNo: true, brand: true, model: true, customer: { select: { name: true, phone: true } }, branch: { select: { name: true } }, items: { where: { removedAt: null }, select: { itemId: true, name: true, unitPricePaise: true } } },
    });
    if (!c) return { message: "Case not found." };
    if (mode === "start" && c.status !== "INTAKE") return { message: "Diagnosis has already started for this case." };
    if (mode === "edit" && !ESTIMATE_EDITABLE.includes(c.status))
      return { message: "Items can only be changed during diagnosis or while approval is pending." };
    // The lab priced a chip-level case's items; the branch can only change the service charge (Billed ₹ column).
    if (mode === "edit" && (await cameFromChipLab(caseId)))
      return { message: "This case came from the chip-level lab. Change the service charge in the Billed ₹ column." };

    const engineer = await db.user.findUnique({ where: { id: data.engineerId }, select: { branchId: true, isActive: true, status: true } });
    if (!engineer?.isActive || engineer.status !== "WORKING" || engineer.branchId !== c.branchId)
      throw new FieldError("engineerId", "Pick someone working in this branch");

    // Lines already on the case may keep an item that was switched off since.
    const kept = new Set(c.items.map((i) => i.itemId));
    const catalog = new Map(
      (await db.item.findMany({ where: { id: { in: data.items.map((l) => l.itemId) } } })).map((i) => [i.id, i]),
    );
    const lines = data.items.map((l, i) => {
      const item = catalog.get(l.itemId);
      if (!item || (!item.isActive && !kept.has(item.id))) throw new FieldError("items", "An item is no longer available — remove it and pick again");
      const min = minPricePaise(item.pricePaise, item.maxDiscountPercent);
      const unit = l.unitPrice!;
      if (unit < min)
        throw new FieldError("items", `${item.name}: lowest allowed price is ${formatPaise(min)} (max ${item.maxDiscountPercent}% discount)`);
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
        sortOrder: i,
        addedById: user.id,
      };
    });
    const total = lines.reduce((sum, l) => sum + l.lineTotalPaise, 0);
    const now = new Date();

    // Chip-level service is planned here, but the case still goes Diagnosis → Pending approval (customer approves the
    // maximum estimate) → Transfer to Chip-Level Lab.
    const isChipRoute = mode === "start" && data.chipLevel;
    const targetStatus = isChipRoute ? "PENDING_APPROVAL" : "DIAGNOSIS";

    const saved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status, ...scope },
        data: {
          ...(mode === "start" ? { status: targetStatus, stageChangedAt: now } : {}),
          ...(mode === "start" && data.chipLevel
            ? { chipBaselinePaise: lines.length ? total : c.estimatedCostPaise, chipMaxEstimatePaise: data.chipMaxEstimate, chipDeadRisk: data.chipDeadRisk }
            : {}),
          engineerId: data.engineerId,
          expectedDeliveryDate: data.expectedDeliveryDate,
          gstInvoiceRequired: data.gstInvoiceRequired,
          // Starting diagnosis without items keeps any estimate given at intake.
          ...(lines.length || mode === "edit" ? { estimatedCostPaise: lines.length ? total : null } : {}),
          updatedById: user.id,
        },
      });
      if (count === 0) return false;
      // Lines are never edited or deleted: retire the current ones, insert the new set.
      await tx.caseItem.updateMany({ where: { caseId, removedAt: null }, data: { removedAt: now, removedById: user.id } });
      if (lines.length) await tx.caseItem.createMany({ data: lines });
      if (mode === "start") {
        if (isChipRoute) {
          // Diagnosis starts and the quote goes out together: Intake → Diagnosis → Pending approval.
          await tx.caseStatusHistory.create({
            data: { caseId, fromStatus: "INTAKE", toStatus: "DIAGNOSIS", note: "Diagnosis started — chip-level service", changedById: user.id, at: now },
          });
          await tx.caseStatusHistory.create({
            data: {
              caseId,
              fromStatus: "DIAGNOSIS",
              toStatus: "PENDING_APPROVAL",
              note: `Chip-level quote sent for customer approval — maximum estimate ${formatPaise(data.chipMaxEstimate ?? 0)}${data.chipDeadRisk ? ", dead risk" : ""}${data.note ? `. ${data.note}` : ""}`,
              changedById: user.id,
              at: new Date(now.getTime() + 1),
            },
          });
        } else {
          await tx.caseStatusHistory.create({
            data: { caseId, fromStatus: "INTAKE", toStatus: targetStatus, note: data.note, changedById: user.id, at: now },
          });
        }
      }
      return true;
    });
    if (!saved) return { message: STALE };

    if (data.advanceAmount && data.advanceMode) {
      // The payment and its ledger entry (Dr Cash/Bank, Cr Customer Advances) are saved together.
      await db.$transaction(async (tx) => {
        const pay = await tx.payment.create({
          data: {
            branchId: c.branchId,
            caseId,
            customerId: c.customerId,
            kind: "ADVANCE",
            mode: data.advanceMode!,
            amountPaise: data.advanceAmount!,
            receivedById: user.id,
          },
          include: { case: { select: { jobsheetNo: true } } },
        });
        await postCasePayment(tx, pay, user.id);
      });
    }

    // Audit trail: every billed amount that changed on an existing line.
    if (mode === "edit") {
      const was = new Map(c.items.map((i) => [i.itemId, i]));
      for (const l of lines) {
        const old = was.get(l.itemId);
        if (old && old.unitPricePaise !== l.unitPricePaise)
          await logActivity({
            action: "case.billing",
            userId: user.id,
            entity: "Case",
            entityId: caseId,
            detail: `${l.name}: billed ${formatPaise(old.unitPricePaise)} → ${formatPaise(l.unitPricePaise)} per unit × ${l.quantity}`,
          });
      }
    }

    const summary = `${lines.length} ${lines.length === 1 ? "item" : "items"}, ${formatPaise(total)}`;
    if (isChipRoute && data.chipMaxEstimate) {
      await sendQuoteNotification({
        customerName: c.customer.name,
        customerPhone: c.customer.phone,
        jobsheetNo: c.jobsheetNo,
        device: [c.brand, c.model].filter(Boolean).join(" "),
        estimatePaise: data.chipMaxEstimate,
        branchName: c.branch.name,
      });
    }
    await logActivity({
      action: mode === "start" ? "case.stage" : "case.estimate",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: isChipRoute ? `INTAKE → DIAGNOSIS → PENDING_APPROVAL (chip-level service, sent for customer approval, ${summary})` : mode === "start" ? `INTAKE → DIAGNOSIS (${summary})` : summary,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return {
      ok: true,
      message: isChipRoute
        ? `Sent for customer approval · maximum estimate ${formatPaise(data.chipMaxEstimate ?? 0)}.`
        : mode === "start"
          ? `Diagnosis started · estimate ${formatPaise(total)}.`
          : `Items saved · estimate ${formatPaise(total)}.`,
    };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

/**
 * Branch records that the customer approved the chip-level quote. The case stays in Pending approval, where the
 * "Transfer to Chip-Level Lab" button takes over. The lab gets the case only after this.
 */
export async function confirmChipCustomerApproval(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = transferToChipSchema.safeParse(pick(formData, ["note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, chipMaxEstimatePaise: true, chipCustomerApprovedAt: true },
    });
    if (!c) return { message: "Case not found." };
    if (c.status !== "PENDING_APPROVAL" || c.chipMaxEstimatePaise === null || c.chipCustomerApprovedAt)
      return { message: "This case isn't waiting for the customer's chip-level approval." };
    if (await pendingApproval(caseId)) return { message: "Head Office approval is pending for this case. It moves on once Head Office decides." };

    const now = new Date();
    const note = `Customer approved the chip-level repair (maximum estimate ${formatPaise(c.chipMaxEstimatePaise)})${parsed.data.note ? ` — ${parsed.data.note}` : ""}`;
    const ok = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: "PENDING_APPROVAL", chipCustomerApprovedAt: null, ...scope },
        data: { chipCustomerApprovedAt: now, updatedById: user.id },
      });
      if (count === 0) return false;
      await tx.caseStatusHistory.create({ data: { caseId, fromStatus: "PENDING_APPROVAL", toStatus: "PENDING_APPROVAL", note, changedById: user.id, at: now } });
      return true;
    });
    if (!ok) return { message: STALE };
    await logActivity({ action: "case.stage", userId: user.id, entity: "Case", entityId: caseId, detail: `Customer approval recorded: ${note}` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: "Customer approval recorded. You can now transfer the case to the chip-level lab." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}
