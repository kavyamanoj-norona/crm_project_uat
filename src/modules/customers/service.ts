import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { nextSequence } from "@/server/sequence";
import { CUSTOMER_LABELS, type LeadSourceValue } from "./schemas";

/** Next customer code: CU000001, CU000002 … Call inside the create transaction. */
export async function nextCustomerCode(tx: Prisma.TransactionClient) {
  return `CU${String(await nextSequence(tx, "CUSTOMER")).padStart(6, "0")}`;
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
export async function upsertIntakeCustomer(tx: Prisma.TransactionClient, input: IntakeCustomerInput, actorId: string) {
  const now = new Date();
  const existing = await tx.customer.findUnique({ where: { phone: input.phone } });

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
