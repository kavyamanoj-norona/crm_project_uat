import "server-only";
import type { Tx } from "@/server/db";
import { CLOSED_STATUSES, CONVERTED_STATUSES, statusAfterCall, type CallOutcomeValue, type LeadStatusValue } from "./status";

// Shared by the actions and by the intake / billing flows that move a lead along. Everything runs inside the caller's transaction.

type CallInput = {
  customerId: string;
  side: "TELECALLER" | "BRANCH";
  outcome: CallOutcomeValue;
  remarks: string | null;
  nextFollowUpAt: Date | null;
  byId: string;
  branchId: string | null;
  /** The caller picked a status explicitly; otherwise the outcome decides. */
  status: LeadStatusValue | null;
};

/**
 * Records one call and keeps the lead's summary in step: last call, outcome, the next follow-up (cleared when the lead is
 * lost, billed or the call ends it) and status. The call row is never edited afterwards, so the telecaller's history stays
 * intact when a branch adds its own update.
 */
export async function addLeadCall(tx: Tx, c: CallInput) {
  const now = new Date();
  const profile =
    (await tx.leadProfile.findUnique({ where: { customerId: c.customerId } })) ??
    (await tx.leadProfile.create({ data: { customerId: c.customerId, status: "NEW", firstInteractionAt: now } }));
  const current = profile.status as LeadStatusValue;

  await tx.leadCall.create({
    data: {
      customerId: c.customerId,
      side: c.side,
      outcome: c.outcome,
      remarks: c.remarks,
      nextFollowUpAt: c.nextFollowUpAt,
      calledAt: now,
      calledById: c.byId,
      branchId: c.branchId,
    },
  });

  const next = c.status ?? statusAfterCall(current, c.outcome);
  const status = next ?? current;
  const endsFollowUps = CLOSED_STATUSES.includes(status);
  await tx.leadProfile.update({
    where: { customerId: c.customerId },
    data: {
      lastCallAt: now,
      lastOutcome: c.outcome,
      nextFollowUpAt: endsFollowUps ? null : c.nextFollowUpAt,
      status,
      firstInteractionAt: profile.firstInteractionAt ?? now,
      // The first telecaller to call an unowned lead owns it.
      ...(c.side === "TELECALLER" && !profile.assignedTelecallerId ? { assignedTelecallerId: c.byId } : {}),
      // An appointment call without a time keeps the one already booked.
    },
  });
  return { from: current, to: status };
}

/** A converted lead opened a case: it has walked in. No-op for customers who were never leads. */
export async function markLeadWalkedIn(tx: Tx, customerId: string, at: Date) {
  await tx.leadProfile.updateMany({
    where: { customerId, status: { notIn: ["WALKED_IN", "BILLED"] }, walkInDate: null },
    data: { status: "WALKED_IN", walkInDate: at, nextFollowUpAt: null },
  });
}

/**
 * A lead's case was invoiced: billed, with the billing date and (when the purchase cost is known) the margin. Only the
 * first invoice counts, and nothing happens for customers who were never leads.
 */
export async function markLeadBilled(tx: Tx, customerId: string, invoice: { id: string; subtotalPaise: number; issuedAt: Date }) {
  const profile = await tx.leadProfile.findUnique({ where: { customerId }, select: { billedInvoiceId: true, purchaseCostPaise: true, marginPaise: true, walkInDate: true } });
  if (!profile || profile.billedInvoiceId) return;
  await tx.leadProfile.update({
    where: { customerId },
    data: {
      status: "BILLED",
      billingDate: invoice.issuedAt,
      billedInvoiceId: invoice.id,
      nextFollowUpAt: null,
      walkInDate: profile.walkInDate ?? invoice.issuedAt,
      ...(profile.purchaseCostPaise !== null ? { marginPaise: invoice.subtotalPaise - profile.purchaseCostPaise } : {}),
    },
  });
}

export { CONVERTED_STATUSES };
