"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { customerWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { CUSTOMER_PATHS } from "./paths";
import { CUSTOMER_FIELDS, CUSTOMER_LABELS, customerSchema } from "./schemas";
import { changedFields, describeChanges, nextCustomerCode } from "./service";

export async function saveCustomer(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = customerSchema.safeParse(pick(formData, CUSTOMER_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;
  const id = formData.get("id")?.toString() || null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.database, id ? "canEdit" : "canCreate");
    const scope = await getBranchScope(actor);
    // The phone is the dedupe key: say who already has it (the unique index still guards races).
    const clash = await db.customer.findFirst({
      where: { phone: data.phone, ...(id ? { NOT: { id } } : {}) },
      select: { code: true, name: true },
    });
    if (clash) throw new FieldError("phone", `This phone belongs to ${clash.name} (${clash.code})`);

    if (id) {
      const existing = await db.customer.findFirst({ where: { id, ...customerWhere(scope) } });
      if (!existing) throw new FieldError("name", "This customer no longer exists.");
      const changed = changedFields(existing, data);
      savedId = id;
      if (changed.length > 0) {
        await db.customer.update({ where: { id }, data: { ...data, updatedById: actor.id } });
        await logActivity({
          action: "customer.update",
          userId: actor.id,
          entity: "Customer",
          entityId: id,
          detail: describeChanges(changed),
        });
      }
    } else {
      const customer = await db.$transaction(async (tx) =>
        tx.customer.create({
          data: {
            ...data,
            code: await nextCustomerCode(tx),
            // the branch the user is working in (null when an all-branch user hasn't picked one)
            branchId: scope.branchId,
            createdById: actor.id,
            updatedById: actor.id,
          },
        }),
      );
      savedId = customer.id;
      await logActivity({ action: "customer.create", userId: actor.id, entity: "Customer", entityId: customer.id });
    }
  } catch (e) {
    return handleActionError(e, CUSTOMER_LABELS, formData);
  }

  revalidatePath(CUSTOMER_PATHS.database, "layout");
  redirect(`${CUSTOMER_PATHS.database}?saved=${Date.now()}&highlight=${savedId}`);
}

/** Customers are never deleted — they are switched off. */
export async function toggleCustomerActive(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.database, "canEdit");
    const row = await db.customer.findFirst({
      where: { id, ...customerWhere(await getBranchScope(actor)) },
      select: { isActive: true },
    });
    if (!row) return { ok: false, message: "Customer not found." };
    await db.customer.update({ where: { id }, data: { isActive: !row.isActive, updatedById: actor.id } });
    await logActivity({
      action: `customer.${row.isActive ? "deactivate" : "activate"}`,
      userId: actor.id,
      entity: "Customer",
      entityId: id,
    });
    revalidatePath(CUSTOMER_PATHS.database, "layout");
    return { ok: true, message: row.isActive ? "Customer deactivated." : "Customer activated." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
