"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { WARRANTY_FIELDS, warrantyName, warrantySchema } from "../warranty-schema";
import { INVENTORY_PATHS } from "../paths";

export async function saveWarranty(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  const parsed = warrantySchema.safeParse(pick(formData, WARRANTY_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  let savedId: string;
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.warranties, id ? "canEdit" : "canCreate");
    const { durationValue, durationUnit } = parsed.data;
    const name = warrantyName(durationValue, durationUnit);

    const same = await db.warranty.findFirst({
      where: { isDelete: 0, durationValue, durationUnit, ...(id ? { id: { not: id } } : {}) },
      select: { name: true },
    });
    if (same) return { message: "This warranty already exists.", fieldErrors: { durationValue: [`${same.name} already exists`] } };

    if (id) {
      const { count } = await db.warranty.updateMany({ where: { id, isDelete: 0 }, data: { name, durationValue, durationUnit } });
      if (count === 0) return { message: "Warranty not found." };
      savedId = id;
    } else {
      savedId = (await db.warranty.create({ data: { name, durationValue, durationUnit, createdById: user.id } })).id;
    }
    await logActivity({ action: id ? "warranty.update" : "warranty.create", userId: user.id, entity: "Warranty", entityId: savedId, detail: name });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(INVENTORY_PATHS.warranties);
  redirect(`${INVENTORY_PATHS.warranties}?saved=${Date.now()}${id ? "" : `&highlight=${savedId}`}`);
}

/** Soft delete. Units already bought keep the warranty they were saved with. */
export async function deleteWarranty(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.warranties, "canEdit");
    const row = await db.warranty.findFirst({ where: { id, isDelete: 0 }, select: { name: true } });
    if (!row) return { ok: false, message: "Warranty not found." };
    await db.warranty.update({ where: { id }, data: { isDelete: 1, isActive: false } });
    await logActivity({ action: "warranty.delete", userId: user.id, entity: "Warranty", entityId: id, detail: `Deleted: ${row.name}` });
    revalidatePath(INVENTORY_PATHS.warranties);
    return { ok: true, message: "Warranty deleted." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
