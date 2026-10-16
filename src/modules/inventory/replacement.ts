import "server-only";
import { db } from "@/server/db";
import { nextSequence } from "@/server/sequence";
import { logActivity } from "@/server/security/activity";
import type { ActionResult } from "@/lib/form";
import { canRequestParts, type CaseStatusValue } from "@/modules/service/case-schema";

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () =>
  periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

const DONE = ["TRANSFERRED", "CONSUMED", "FULFILLED", "REJECTED"];

/**
 * Orders an item again for a case because the unit already transferred is defective or not working.
 * Allowed only when the latest request for that item on the case has been transferred, and none is still in
 * progress. The new request is tagged Replacement / Reorder, keeps the original request's branch, case and model
 * number, and records who confirmed it and why.
 */
export async function createReplacementRequest(opts: {
  caseId: string;
  itemId: string;
  reason: string;
  userId: string;
}): Promise<ActionResult> {
  const kase = await db.case.findUnique({ where: { id: opts.caseId }, select: { status: true, jobsheetNo: true } });
  if (!kase || !canRequestParts(kase.status as CaseStatusValue)) return { ok: false, message: "Parts can be requested once the approval is complete." };

  const previous = await db.purchaseRequest.findMany({
    where: { caseId: opts.caseId, itemId: opts.itemId },
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, status: true, branchId: true, quantity: true, modelNo: true, branch: { select: { code: true } } },
  });
  const latest = previous[0];
  if (!latest) return { ok: false, message: "Nothing has been requested for this item yet." };
  if (previous.some((p) => !DONE.includes(p.status))) return { ok: false, message: "A request for this item is already in progress." };
  if (latest.status !== "TRANSFERRED" && latest.status !== "CONSUMED") return { ok: false, message: "Only an item that was already transferred can be reordered." };

  const created = await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `PR:${latest.branch.code}:${period()}`);
    const code = `PR-${latest.branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
    return tx.purchaseRequest.create({
      data: {
        code,
        branchId: latest.branchId,
        itemId: opts.itemId,
        caseId: opts.caseId,
        quantity: 1,
        modelNo: latest.modelNo,
        requestedById: opts.userId,
        isReplacement: true,
        replacementOfId: latest.id,
        replacementReason: opts.reason,
        replacementConfirmedById: opts.userId,
        replacementConfirmedAt: new Date(),
      },
      select: { id: true, code: true },
    });
  });
  await logActivity({
    action: "inventory.reorder",
    userId: opts.userId,
    entity: "PurchaseRequest",
    entityId: created.id,
    detail: `Replacement / reorder ${created.code} for ${kase.jobsheetNo} (replaces ${latest.code}): ${opts.reason}`,
  });
  return { ok: true, message: "Reorder requested." };
}
