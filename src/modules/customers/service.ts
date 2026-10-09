import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextSequence } from "@/server/sequence";
import { CUSTOMER_LABELS, type LeadSourceValue } from "./schemas";

/** Next customer code: CU000001, CU000002 … Call inside the create transaction. */
export async function nextCustomerCode(tx: Prisma.TransactionClient) {
  return `CU${String(await nextSequence(tx, "CUSTOMER")).padStart(6, "0")}`;
}

/** Next lead code: LD000001, LD000002 … Separate counter from customers. */
export async function nextLeadCode(tx: Prisma.TransactionClient) {
  return `LD${String(await nextSequence(tx, "LEAD")).padStart(6, "0")}`;
}

export type NewLeadInput = {
  name: string;
  phone: string;
  purpose: string;
  email: string | null;
  source: LeadSourceValue | "WEBSITE" | null;
  notes: string | null;
};

/** Creates a lead (a customer-table row with kind LEAD). Call inside a transaction. */
export async function createLeadRecord(
  tx: Prisma.TransactionClient,
  input: NewLeadInput,
  who: { branchId: string | null; actorId: string | null },
) {
  const code = await nextLeadCode(tx);
  return tx.customer.create({
    data: {
      ...input,
      code,
      leadCode: code,
      kind: "LEAD",
      branchId: who.branchId,
      createdById: who.actorId,
      updatedById: who.actorId,
    },
  });
}

/**
 * Turns a lead into a customer on the SAME row: it gets a CU code (the LD code
 * is kept in leadCode), so nothing is duplicated and links stay valid. Returns
 * null if the row is no longer an open lead (already converted by someone else).
 */
export async function convertLeadRecord(
  tx: Prisma.TransactionClient,
  leadId: string,
  actorId: string,
  /** Home branch for a lead that has none yet (e.g. a website enquiry). */
  fallbackBranchId: string | null,
) {
  const lead = await tx.customer.findFirst({ where: { id: leadId, kind: "LEAD" }, select: { branchId: true } });
  if (!lead) return null;
  const { count } = await tx.customer.updateMany({
    where: { id: leadId, kind: "LEAD" },
    data: {
      kind: "CUSTOMER",
      code: await nextCustomerCode(tx),
      convertedAt: new Date(),
      convertedById: actorId,
      isActive: true,
      branchId: lead.branchId ?? fallbackBranchId,
      updatedById: actorId,
    },
  });
  return count === 0 ? null : tx.customer.findUniqueOrThrow({ where: { id: leadId } });
}

/** Keys of `after` whose value differs from `before`. */
export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.keys(after).filter((k) => (before[k] ?? null) !== (after[k] ?? null));
}

/** "Changed: Name, Email" — stored as the activity log detail of an edit. */
export function describeChanges(fields: string[]) {
  return `Changed: ${fields.map((f) => CUSTOMER_LABELS[f] ?? f).join(", ")}`;
}

export type IntakeCustomerInput = {
  phone: string;
  name: string;
  email: string | null;
  altPhone: string | null;
  source: LeadSourceValue;
};

/**
 * Finds the customer by phone (the dedupe key) or creates one, and counts the
 * visit. Details confirmed at the counter replace the stored ones, but an empty
 * field never wipes what we already have.
 */
export async function upsertIntakeCustomer(
  tx: Prisma.TransactionClient,
  input: IntakeCustomerInput,
  actorId: string,
  /** The branch taking the case: becomes the home branch of a new customer. */
  branchId: string,
) {
  const now = new Date();
  let existing = await tx.customer.findUnique({ where: { phone: input.phone } });
  // A lead with this phone becomes the customer (same row) rather than a duplicate.
  if (existing?.kind === "LEAD") existing = (await convertLeadRecord(tx, existing.id, actorId, branchId)) ?? existing;

  if (!existing) {
    const customer = await tx.customer.create({
      data: {
        code: await nextCustomerCode(tx),
        name: input.name,
        phone: input.phone,
        email: input.email,
        altPhone: input.altPhone,
        source: input.source,
        visitCount: 1,
        lastVisitAt: now,
        branchId,
        createdById: actorId,
        updatedById: actorId,
      },
    });
    return { customer, created: true, changed: [] as string[] };
  }

  const updates: Record<string, string> = { name: input.name };
  if (input.email) updates.email = input.email;
  if (input.altPhone) updates.altPhone = input.altPhone;
  const changed = changedFields(existing, updates);

  const customer = await tx.customer.update({
    where: { id: existing.id },
    data: {
      ...Object.fromEntries(changed.map((k) => [k, updates[k]])),
      visitCount: { increment: 1 },
      lastVisitAt: now,
      updatedById: actorId,
    },
  });
  return { customer, created: false, changed };
}
