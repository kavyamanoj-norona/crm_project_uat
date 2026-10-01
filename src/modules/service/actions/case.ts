"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { decryptText } from "@/server/crypto";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import type { CurrentUser } from "@/server/auth/session";
import type { RevealResult } from "@/components/ui/secret-reveal";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import {
  CASE_STATUS_LABELS,
  ESTIMATE_EDITABLE,
  cancelSchema,
  estimateSchema,
  isOpenStatus,
  nextStage,
  stageChangeSchema,
  type CaseStatusValue,
} from "../case-schema";
import { SERVICE_PATHS } from "../paths";

const STALE = "Someone else changed this case just now. Refresh to see its current stage.";

/**
 * Moves a case from `from` to `to` and writes the timeline entry. The update
 * only matches while the case is still in `from` (and in the user's branch
 * scope), so two people clicking at once can't both move it.
 */
async function applyStage(caseId: string, from: CaseStatusValue, to: CaseStatusValue, note: string | null, userId: string, scope: { branchId?: string }) {
  const moved = await db.$transaction(async (tx) => {
    const { count } = await tx.case.updateMany({
      where: { id: caseId, status: from, ...scope },
      data: { status: to, stageChangedAt: new Date(), updatedById: userId },
    });
    if (count === 0) return false;
    await tx.caseStatusHistory.create({ data: { caseId, fromStatus: from, toStatus: to, note, changedById: userId } });
    return true;
  });
  if (moved) {
    await logActivity({ action: "case.stage", userId, entity: "Case", entityId: caseId, detail: `${from} → ${to}${note ? `: ${note}` : ""}` });
    revalidatePath(SERVICE_PATHS.cases, "layout");
  }
  return moved;
}

/** Loads the case inside the user's branch scope (null = not found / other branch). */
async function scopedCase(caseId: string, user: CurrentUser) {
  const scope = branchWhere(await getBranchScope(user));
  const row = await db.case.findFirst({ where: { id: caseId, ...scope }, select: { status: true } });
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
    if (!(await applyStage(caseId, row.status, to, null, user.id, scope))) return { ok: false, message: STALE };
    return { ok: true, message: `Moved to ${CASE_STATUS_LABELS[to]}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
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
    if (toStatus === row.status) return { message: "The case is already in that stage.", fieldErrors: { toStatus: ["Pick a different stage"] } };
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

const ESTIMATE_FIELDS = ["engineerId", "expectedDeliveryDate", "gstInvoiceRequired", "note", "items"];

/**
 * "Start diagnosis" (mode start: Intake → Diagnosis) and "Edit items" (mode
 * edit, while in Diagnosis / Pending approval). Assigns the engineer, replaces
 * the billable lines and sets the estimate to their total. Prices are checked
 * against the catalog: never below the item's minimum, never above its list price.
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
      select: { status: true, branchId: true, items: { where: { removedAt: null }, select: { itemId: true } } },
    });
    if (!c) return { message: "Case not found." };
    if (mode === "start" && c.status !== "INTAKE") return { message: "Diagnosis has already started for this case." };
    if (mode === "edit" && !ESTIMATE_EDITABLE.includes(c.status))
      return { message: "Items can only be changed during diagnosis or while approval is pending." };

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
      if (unit > item.pricePaise) throw new FieldError("items", `${item.name}: price can't be above ${formatPaise(item.pricePaise)}`);
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

    const saved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status, ...scope },
        data: {
          ...(mode === "start" ? { status: "DIAGNOSIS" as const, stageChangedAt: now } : {}),
          engineerId: data.engineerId,
          expectedDeliveryDate: data.expectedDeliveryDate,
          gstInvoiceRequired: data.gstInvoiceRequired,
          estimatedCostPaise: lines.length ? total : null,
          updatedById: user.id,
        },
      });
      if (count === 0) return false;
      // Lines are never edited or deleted: retire the current ones, insert the new set.
      await tx.caseItem.updateMany({ where: { caseId, removedAt: null }, data: { removedAt: now, removedById: user.id } });
      if (lines.length) await tx.caseItem.createMany({ data: lines });
      if (mode === "start") {
        await tx.caseStatusHistory.create({
          data: { caseId, fromStatus: "INTAKE", toStatus: "DIAGNOSIS", note: data.note, changedById: user.id, at: now },
        });
      }
      return true;
    });
    if (!saved) return { message: STALE };

    const summary = `${lines.length} ${lines.length === 1 ? "item" : "items"}, ${formatPaise(total)}`;
    await logActivity({
      action: mode === "start" ? "case.stage" : "case.estimate",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: mode === "start" ? `INTAKE → DIAGNOSIS (${summary})` : summary,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: mode === "start" ? `Diagnosis started · estimate ${formatPaise(total)}.` : `Items saved · estimate ${formatPaise(total)}.` };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}
