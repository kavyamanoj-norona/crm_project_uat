"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { handleActionError } from "@/server/prisma-errors";
import { formatPaise } from "@/lib/money";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { approvalDecisionSchema, approvalRequestSchema } from "../case-schema";
import { billingBlockReason } from "../billing-guard";
import { SERVICE_PATHS } from "../paths";

const STALE = "This case or request changed just now. Refresh to see its current state.";

class StaleError extends Error {}

/** Branch asks Head Office to confirm a quotation the customer approved verbally (or any way other than WhatsApp). */
export async function requestHeadOfficeApproval(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = approvalRequestSchema.safeParse(pick(formData, ["note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({
      where: { id: caseId, ...scope },
      select: { status: true, branchId: true, jobsheetNo: true, estimatedCostPaise: true },
    });
    if (!c) return { message: "Case not found." };
    if (c.status !== "PENDING_APPROVAL") return { message: "Approval can only be requested while the case is in Pending approval." };
    const quote = c.estimatedCostPaise;
    if (!quote) return { message: "The case has no quotation amount yet." };
    const bill = await billingBlockReason(caseId);
    if (bill) return { message: bill };

    const created = await db.$transaction(async (tx) => {
      if (await tx.caseApprovalRequest.findFirst({ where: { caseId, kind: "MANUAL_APPROVAL", status: "PENDING" }, select: { id: true } })) return false;
      await tx.caseApprovalRequest.create({
        data: { caseId, branchId: c.branchId, quoteAmountPaise: quote, requestNote: parsed.data.note, requestedById: user.id },
      });
      return true;
    });
    if (!created) return { message: "Head Office approval is already requested for this case." };

    await logActivity({
      action: "case.approval.request",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Requested Head Office approval for ${formatPaise(quote)}: ${parsed.data.note}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.approvals);
    return { ok: true, message: `Approval requested from Head Office for ${c.jobsheetNo}.` };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

/**
 * Head Office decides a request. Approving moves the case Pending approval → Awaiting stock (the same move the branch
 * makes after a WhatsApp approval) and writes the timeline entry; rejecting leaves the case where it is.
 */
export async function decideApprovalRequest(
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = approvalDecisionSchema.safeParse(pick(formData, ["remarks"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { remarks } = parsed.data;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.approvals, "canApprove");
    if (!isPurchaseManager(user)) throw new ForbiddenError();
    const scope = branchWhere(await getBranchScope(user));
    const req = await db.caseApprovalRequest.findFirst({
      where: { id: requestId, kind: "MANUAL_APPROVAL", status: "PENDING", case: { ...scope } },
      include: { case: { select: { id: true, status: true, jobsheetNo: true, estimatedCostPaise: true, chipMaxEstimatePaise: true, chipCustomerApprovedAt: true } } },
    });
    if (!req) return { message: STALE };
    const c = req.case;
    const chipPending = c.chipMaxEstimatePaise !== null && !c.chipCustomerApprovedAt;
    if (c.status !== "PENDING_APPROVAL") return { message: "This case is no longer in Pending approval." };

    if (decision === "APPROVED") {
      if (c.estimatedCostPaise !== req.quoteAmountPaise)
        return {
          message: `The quotation changed since the request (${formatPaise(req.quoteAmountPaise)} → ${formatPaise(c.estimatedCostPaise ?? 0)}). Reject it so the branch can ask again.`,
        };
      const bill = await billingBlockReason(c.id);
      if (bill) return { message: bill };
    }

    const now = new Date();
    const ok = await db.$transaction(async (tx) => {
      const { count } = await tx.caseApprovalRequest.updateMany({
        where: { id: requestId, status: "PENDING" },
        data: { status: decision, reviewedById: user.id, reviewRemarks: remarks, reviewedAt: now },
      });
      if (count === 0) return false;
      if (decision === "APPROVED") {
        const moved = await tx.case.updateMany({
          where: { id: c.id, status: "PENDING_APPROVAL" },
          data: chipPending
            ? { chipCustomerApprovedAt: now, updatedById: user.id }
            : { status: "AWAITING_STOCK", stageChangedAt: now, updatedById: user.id },
        });
        if (moved.count === 0) throw new StaleError();
        await tx.caseStatusHistory.create({
          data: {
            caseId: c.id,
            fromStatus: "PENDING_APPROVAL",
            toStatus: chipPending ? "PENDING_APPROVAL" : "AWAITING_STOCK",
            note: `Customer approval confirmed by Head Office — ${remarks}`,
            changedById: user.id,
            at: now,
          },
        });
      }
      return true;
    });
    if (!ok) return { message: STALE };

    await logActivity({
      action: decision === "APPROVED" ? "case.approval.approve" : "case.approval.reject",
      userId: user.id,
      entity: "Case",
      entityId: c.id,
      detail: `${decision === "APPROVED" ? "Approved" : "Rejected"} Head Office approval request (${formatPaise(req.quoteAmountPaise)}): ${remarks}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.approvals);
    return {
      ok: true,
      message:
        decision === "APPROVED"
          ? chipPending
            ? `${c.jobsheetNo} approved — the branch can now transfer it to the chip-level lab.`
            : `${c.jobsheetNo} approved — moved to Awaiting stock.`
          : `${c.jobsheetNo} request rejected.`,
    };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof StaleError) return { message: STALE };
    return handleActionError(e, {}, formData);
  }
}
