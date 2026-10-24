"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { labCasePath, notify } from "@/server/notify/push";
import { sendQuoteNotification } from "@/server/notify/customer";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { handleActionError } from "@/server/prisma-errors";
import { formatPaise } from "@/lib/money";
import { approvalDecisionSchema } from "../case-schema";
import { SERVICE_PATHS } from "../paths";

// Chip-level lab quotes: the lab's estimate went above the case total, so the originating branch sends the quote
// to the customer and records their answer. The answer moves the case in the lab: approved → In Servicing,
// rejected → back to Lab Diagnosis.

const STALE = "This case or request changed just now. Refresh to see its current state.";

class StaleError extends Error {}

/** Branch staff handle lab quotes; the Purchase Manager's inbox is for manual Head Office approvals. */
function requireBranchSide(user: { privilege: { code: string } }) {
  if (user.privilege.code === "PURCHASE_MANAGER") throw new ForbiddenError();
}

/** Branch sends the lab's quote to the customer, with remarks. */
export async function sendLabQuoteToCustomer(requestId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = approvalDecisionSchema.safeParse(pick(formData, ["remarks"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { remarks } = parsed.data;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.approvals, "canApprove");
    requireBranchSide(user);
    const scope = branchWhere(await getBranchScope(user));
    const req = await db.caseApprovalRequest.findFirst({
      where: { id: requestId, kind: "LAB_QUOTE", status: "PENDING", case: { ...scope } },
      include: {
        case: {
          select: {
            id: true,
            status: true,
            jobsheetNo: true,
            estimatedCostPaise: true,
            brand: true,
            model: true,
            customer: { select: { name: true, phone: true } },
            branch: { select: { name: true } },
          },
        },
      },
    });
    if (!req) return { message: STALE };
    const c = req.case;
    if (c.status !== "CHIP_LAB_PENDING_APPROVAL") return { message: "This case is no longer waiting for customer approval." };
    if (c.estimatedCostPaise !== req.quoteAmountPaise) return { message: "The lab changed the estimate after sending it. Ask the lab to submit it again." };

    const { count } = await db.caseApprovalRequest.updateMany({
      where: { id: requestId, status: "PENDING" },
      data: { status: "SENT", sendRemarks: remarks, sentById: user.id, sentAt: new Date() },
    });
    if (count === 0) return { message: STALE };

    await sendQuoteNotification({
      customerName: c.customer.name,
      customerPhone: c.customer.phone,
      jobsheetNo: c.jobsheetNo,
      device: [c.brand, c.model].filter(Boolean).join(" "),
      estimatePaise: req.quoteAmountPaise,
      branchName: c.branch.name,
    });
    await logActivity({
      action: "case.approval.send",
      userId: user.id,
      entity: "Case",
      entityId: c.id,
      detail: `Sent the lab quote ${formatPaise(req.quoteAmountPaise)} to the customer: ${remarks}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath(SERVICE_PATHS.approvals);
    return { ok: true, message: `Quote sent to the customer for ${c.jobsheetNo}. Record their answer when they reply.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    return handleActionError(e, {}, formData);
  }
}

/** Branch records the customer's answer; the case in the lab moves on (or back) with it. */
export async function recordLabQuoteDecision(
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
    requireBranchSide(user);
    const scope = branchWhere(await getBranchScope(user));
    const req = await db.caseApprovalRequest.findFirst({
      where: { id: requestId, kind: "LAB_QUOTE", status: "SENT", case: { ...scope } },
      include: { case: { select: { id: true, status: true, jobsheetNo: true, estimatedCostPaise: true } } },
    });
    if (!req) return { message: STALE };
    const c = req.case;
    if (c.status !== "CHIP_LAB_PENDING_APPROVAL") return { message: "This case is no longer waiting for customer approval." };
    if (decision === "APPROVED" && c.estimatedCostPaise !== req.quoteAmountPaise)
      return { message: "The lab changed the estimate after the quote was sent. Ask the lab to submit it again." };

    const to = decision === "APPROVED" ? "CHIP_LAB_SERVICING" : "CHIP_LAB_DIAGNOSIS";
    const word = decision === "APPROVED" ? "approved" : "rejected";
    const now = new Date();
    const ok = await db.$transaction(async (tx) => {
      const { count } = await tx.caseApprovalRequest.updateMany({
        where: { id: requestId, status: "SENT" },
        data: { status: decision, reviewedById: user.id, reviewRemarks: remarks, reviewedAt: now },
      });
      if (count === 0) return false;
      const moved = await tx.case.updateMany({
        where: { id: c.id, status: "CHIP_LAB_PENDING_APPROVAL" },
        data: {
          status: to,
          stageChangedAt: now,
          updatedById: user.id,
          // An approved estimate becomes the new total any later lab estimate is compared with.
          ...(decision === "APPROVED" ? { chipBaselinePaise: req.quoteAmountPaise } : {}),
        },
      });
      if (moved.count === 0) throw new StaleError();
      await tx.caseStatusHistory.create({
        data: {
          caseId: c.id,
          fromStatus: "CHIP_LAB_PENDING_APPROVAL",
          toStatus: to,
          note: `Customer ${word} the lab estimate ${formatPaise(req.quoteAmountPaise)} — ${remarks}`,
          changedById: user.id,
          at: now,
        },
      });
      return true;
    });
    if (!ok) return { message: STALE };

    await logActivity({
      action: decision === "APPROVED" ? "case.approval.approve" : "case.approval.reject",
      userId: user.id,
      entity: "Case",
      entityId: c.id,
      detail: `Customer ${word} the lab estimate (${formatPaise(req.quoteAmountPaise)}): ${remarks}`,
    });
    notify(
      { privileges: ["CHIP_COORDINATOR"], exceptUserId: user.id },
      { category: "SERVICE", title: `${c.jobsheetNo}: customer ${word} the lab estimate`, body: decision === "APPROVED" ? "You can start servicing." : "The case is back in lab diagnosis.", url: labCasePath(c.id), tag: `lab-quote-${c.id}` },
    );
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath(SERVICE_PATHS.lab, "layout");
    revalidatePath(SERVICE_PATHS.approvals);
    return {
      ok: true,
      message: decision === "APPROVED" ? `${c.jobsheetNo}: customer approved — the lab can start servicing.` : `${c.jobsheetNo}: customer rejected — the case is back with the lab.`,
    };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof StaleError) return { message: STALE };
    return handleActionError(e, {}, formData);
  }
}
