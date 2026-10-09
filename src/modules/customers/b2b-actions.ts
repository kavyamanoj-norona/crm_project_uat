"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { customerWhere, getBranchScope } from "@/server/branch-scope";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { CUSTOMER_PATHS } from "./paths";
import { B2B_FIELDS, B2B_LABELS, b2bSchema } from "./b2b-schemas";
import { changedFields, describeChanges, nextCustomerCode } from "./service";

/** Creates or updates a B2B account (a customer of type BUSINESS). */
export async function saveB2bAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = b2bSchema.safeParse(pick(formData, B2B_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;
  const id = formData.get("id")?.toString() || null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.b2b, id ? "canEdit" : "canCreate");
    const scope = await getBranchScope(actor);
    // The phone is the dedupe key across customers and leads.
    const clash = await db.customer.findFirst({
      where: { phone: data.phone, ...(id ? { NOT: { id } } : {}) },
      select: { code: true, name: true },
    });
    if (clash) throw new FieldError("phone", `This phone belongs to ${clash.name} (${clash.code})`);

    if (id) {
      const existing = await db.customer.findFirst({ where: { AND: [customerWhere(scope), { id, type: "BUSINESS" }] } });
      if (!existing) throw new FieldError("name", "This account no longer exists.");
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
            type: "BUSINESS",
            code: await nextCustomerCode(tx),
            branchId: scope.branchId,
            createdById: actor.id,
            updatedById: actor.id,
          },
        }),
      );
      savedId = customer.id;
      await logActivity({ action: "customer.create", userId: actor.id, entity: "Customer", entityId: customer.id, detail: "B2B account" });
    }
  } catch (e) {
    return handleActionError(e, B2B_LABELS, formData);
  }

  revalidatePath(CUSTOMER_PATHS.b2b, "layout");
  revalidatePath(CUSTOMER_PATHS.database, "layout");
  redirect(`${CUSTOMER_PATHS.b2b}?saved=${Date.now()}&highlight=${savedId}`);
}
