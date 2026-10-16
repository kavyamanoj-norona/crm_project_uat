import "server-only";
import { db, type Tx } from "@/server/db";
import { nextSequence } from "@/server/sequence";
import { logActivity } from "@/server/security/activity";
import type { ActionResult } from "@/lib/form";

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () =>
  periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

export { VR_STATUS_LABELS } from "./vendor-replacement-labels";

/**
 * A defective / not-working unit goes back for a vendor replacement. The replacement reuses the same USID, so there is no
 * new purchase and no new stock entry. Created inside the return transaction; the caller logs it.
 */
export async function createVendorReplacement(
  tx: Tx,
  opts: { unitId: string; caseId: string; branchId: string; itemId: string; remarks: string; userId: string },
) {
  const branch = await tx.branch.findUniqueOrThrow({ where: { id: opts.branchId }, select: { code: true } });
  const seq = await nextSequence(tx, `VR:${branch.code}:${period()}`);
  const code = `VR-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
  return tx.vendorReplacement.create({
    data: { code, unitId: opts.unitId, caseId: opts.caseId, branchId: opts.branchId, itemId: opts.itemId, remarks: opts.remarks, requestedById: opts.userId },
    select: { id: true, code: true },
  });
}

/** The vendor has the replacement ready (same USID). The branch is not waiting for the defective unit to reach Head Office. */
export async function markVendorReplacementReady(id: string, userId: string, vendorName: string, vendorRemarks: string): Promise<ActionResult> {
  const vr = await db.$transaction(async (tx) => {
    const row = await tx.vendorReplacement.findUnique({ where: { id }, select: { code: true, status: true, unitId: true, caseId: true, unit: { select: { usid: true } }, case: { select: { jobsheetNo: true } } } });
    if (!row || row.status !== "REQUESTED") return null;
    const done = await tx.vendorReplacement.updateMany({
      where: { id, status: "REQUESTED" },
      data: { status: "READY", vendorName: vendorName || null, vendorRemarks: vendorRemarks || null, vendorReadyAt: new Date(), vendorReadyById: userId },
    });
    if (done.count === 0) return null;
    await tx.stockUnitEvent.create({ data: { unitId: row.unitId, action: "REPLACED", userId, caseId: row.caseId, note: `${row.code}: vendor replacement ready (same USID)${vendorName ? ` from ${vendorName}` : ""}` } });
    return row;
  });
  if (!vr) return { ok: false, message: "This replacement is not waiting for the vendor." };
  await logActivity({
    action: "inventory.vendor-replacement.ready",
    userId,
    entity: "VendorReplacement",
    entityId: id,
    detail: `${vr.code}: vendor replacement ready for ${vr.unit.usid}${vr.case ? ` (case ${vr.case.jobsheetNo})` : ""}${vendorName ? ` from ${vendorName}` : ""}`,
  });
  return { ok: true, message: "Replacement marked ready." };
}

/**
 * Transfers the vendor replacement (the same USID) to the case's branch. It does not wait for the defective unit to reach
 * Head Office, and it creates no stock entry: the unit goes straight from the vendor to the branch, which confirms receipt
 * like any transferred unit.
 */
export async function transferVendorReplacement(id: string, userId: string): Promise<ActionResult> {
  const vr = await db.$transaction(async (tx) => {
    const row = await tx.vendorReplacement.findUnique({
      where: { id },
      select: { code: true, status: true, unitId: true, caseId: true, branchId: true, unit: { select: { usid: true, status: true } }, case: { select: { jobsheetNo: true, status: true } } },
    });
    if (!row || row.status !== "READY") return { error: "The vendor replacement must be ready before it can be transferred." } as const;
    if (!row.caseId || !row.case || row.case.status === "CLOSED" || row.case.status === "CANCELLED") return { error: "The case is closed, so nothing can be transferred for it." } as const;
    if (row.unit.status !== "AWAITING_VENDOR") return { error: "This USID is not waiting for a vendor replacement." } as const;
    const now = new Date();
    const claimed = await tx.stockUnit.updateMany({
      where: { id: row.unitId, status: "AWAITING_VENDOR" },
      data: {
        status: "ALLOCATED",
        allocatedAt: now,
        allocatedById: userId,
        allocatedCaseId: row.caseId,
        allocatedBranchId: row.branchId,
        purchaseRequestId: null,
        receivedAt: null,
        receivedById: null,
        returnType: null,
        returnRemarks: null,
        returnedAt: null,
        returnedById: null,
        returnReceivedAt: null,
        returnReceivedById: null,
        note: `Vendor replacement ${row.code} (same USID)`,
      },
    });
    if (claimed.count === 0) return { error: "This USID was just changed by someone else." } as const;
    await tx.vendorReplacement.update({ where: { id }, data: { status: "TRANSFERRED", transferredAt: now, transferredById: userId } });
    await tx.stockUnitEvent.create({
      data: { unitId: row.unitId, action: "ALLOCATED", userId, caseId: row.caseId, branchId: row.branchId, note: `${row.code}: vendor replacement transferred to the branch (same USID)` },
    });
    return { row } as const;
  });
  if (!("row" in vr) || !vr.row) return { ok: false, message: ("error" in vr && vr.error) || "Could not transfer." };
  await logActivity({
    action: "inventory.vendor-replacement.transfer",
    userId,
    entity: "VendorReplacement",
    entityId: id,
    detail: `${vr.row.code}: ${vr.row.unit.usid} (vendor replacement) transferred to the branch for ${vr.row.case?.jobsheetNo ?? "the case"}`,
  });
  return { ok: true, message: `${vr.row.unit.usid} transferred to the branch.` };
}

/** Head Office confirms the defective unit has arrived. Tracked separately: the replacement never waits for this. */
export async function receiveDefectiveReturn(id: string, userId: string): Promise<ActionResult> {
  const vr = await db.$transaction(async (tx) => {
    const row = await tx.vendorReplacement.findUnique({ where: { id }, select: { code: true, returnReceivedAt: true, unitId: true, caseId: true, unit: { select: { usid: true } }, case: { select: { jobsheetNo: true } } } });
    if (!row || row.returnReceivedAt) return null;
    const done = await tx.vendorReplacement.updateMany({ where: { id, returnReceivedAt: null }, data: { returnReceivedAt: new Date(), returnReceivedById: userId } });
    if (done.count === 0) return null;
    await tx.stockUnitEvent.create({ data: { unitId: row.unitId, action: "RETURNED", userId, caseId: row.caseId, note: `${row.code}: defective unit received at Head Office` } });
    return row;
  });
  if (!vr) return { ok: false, message: "This defective unit was already received." };
  await logActivity({
    action: "inventory.vendor-replacement.return-received",
    userId,
    entity: "VendorReplacement",
    entityId: id,
    detail: `${vr.code}: defective unit ${vr.unit.usid} received at Head Office${vr.case ? ` (from ${vr.case.jobsheetNo})` : ""}`,
  });
  return { ok: true, message: `${vr.unit.usid} received at Head Office.` };
}

/** Called when a branch confirms receipt of a transferred unit: closes the vendor replacement if the unit was one. */
export async function noteReplacementReceivedByBranch(unitId: string, userId: string) {
  const vr = await db.vendorReplacement.findFirst({ where: { unitId, status: "TRANSFERRED" }, select: { id: true, code: true, unit: { select: { usid: true } }, case: { select: { jobsheetNo: true } } } });
  if (!vr) return;
  await db.vendorReplacement.update({ where: { id: vr.id }, data: { status: "RECEIVED", receivedAt: new Date(), receivedById: userId } });
  await logActivity({
    action: "inventory.vendor-replacement.received",
    userId,
    entity: "VendorReplacement",
    entityId: vr.id,
    detail: `${vr.code}: vendor replacement ${vr.unit.usid} received by the branch${vr.case ? ` for ${vr.case.jobsheetNo}` : ""}`,
  });
}
