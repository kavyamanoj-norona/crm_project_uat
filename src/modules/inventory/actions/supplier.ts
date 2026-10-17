"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { SUPPLIER_FIELDS, supplierSchema } from "../supplier-schema";
import { INVENTORY_PATHS } from "../paths";

export async function saveSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  const parsed = supplierSchema.safeParse(pick(formData, SUPPLIER_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  let savedId: string;
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.suppliers, id ? "canEdit" : "canCreate");
    const { name, gstin, state, phone, email, address, paymentTermDays } = parsed.data;

    if (gstin) {
      const same = await db.supplier.findFirst({ where: { gstin, ...(id ? { id: { not: id } } : {}) }, select: { name: true } });
      if (same) return { message: "This GSTIN is already used.", fieldErrors: { gstin: [`${same.name} already has this GSTIN`] } };
    }

    const data = { name, gstin: gstin ?? null, state: state ?? null, phone: phone ?? null, email: email ?? null, address: address ?? null, paymentTermDays: paymentTermDays ? Number(paymentTermDays) : null };
    if (id) {
      const { count } = await db.supplier.updateMany({ where: { id }, data });
      if (count === 0) return { message: "Supplier not found." };
      savedId = id;
    } else {
      savedId = (await db.supplier.create({ data })).id;
    }
    await logActivity({
      action: id ? "supplier.update" : "supplier.create",
      userId: user.id,
      entity: "Supplier",
      entityId: savedId,
      detail: name,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(INVENTORY_PATHS.suppliers);
  redirect(`${INVENTORY_PATHS.suppliers}?saved=${Date.now()}${id ? "" : `&highlight=${savedId}`}`);
}

/** Soft delete — sets `isDelete = 1`. Past bills keep pointing at the supplier. */
export async function deleteSupplier(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.suppliers, "canEdit");
    const supplier = await db.supplier.findUnique({ where: { id }, select: { name: true } });
    if (!supplier) return { ok: false, message: "Supplier not found." };
    await db.supplier.update({ where: { id }, data: { isDelete: 1 } });
    await logActivity({ action: "supplier.delete", userId: user.id, entity: "Supplier", entityId: id, detail: `Deleted: ${supplier.name}` });
    revalidatePath(INVENTORY_PATHS.suppliers);
    return { ok: true, message: "Supplier deleted." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
