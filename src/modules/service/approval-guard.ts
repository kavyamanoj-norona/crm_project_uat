import "server-only";
import { db } from "@/server/db";

/** The open Head Office approval request on a case, if any. */
export function pendingApproval(caseId: string) {
  return db.caseApprovalRequest.findFirst({ where: { caseId, kind: "MANUAL_APPROVAL", status: "PENDING" }, select: { id: true } });
}

/** Reason a case can't leave Pending approval yet: Head Office hasn't decided its manual approval request. */
export async function approvalBlockReason(caseId: string) {
  if (await pendingApproval(caseId)) return "Head Office approval is pending for this case. It moves on once Head Office decides.";
  const c = await db.case.findUnique({ where: { id: caseId }, select: { chipMaxEstimatePaise: true, chipCustomerApprovedAt: true } });
  // Before its trip to the lab, a chip-level case goes on only by being transferred there.
  if (c && c.chipMaxEstimatePaise !== null && (await db.caseStatusHistory.count({ where: { caseId, toStatus: "CHIP_TRANSFER" } })) === 0)
    return c.chipCustomerApprovedAt ? "Transfer this case to the chip-level lab." : "Record the customer's chip-level approval first.";
  return null;
}
