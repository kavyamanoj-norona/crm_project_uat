"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { VENDOR_FIELDS, vendorSchema } from "../vendor-schema";
import { SERVICE_PATHS } from "../paths";

export async function saveVendor(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  const parsed = vendorSchema.safeParse(pick(formData, VENDOR_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  let savedId: string;
  try {
    const user = await requireActionPermission(SERVICE_PATHS.vendors, id ? "canEdit" : "canCreate");
    const { name, contactName, phone, email, address, remarks } = parsed.data;
    const data = {
      name,
      contactName: contactName ?? null,
      phone: phone ?? null,
      email: email ?? null,
      address: address ?? null,
      remarks: remarks ?? null,
    };
    if (id) {
      const { count } = await db.chipLabVendor.updateMany({ where: { id }, data: { ...data, updatedById: user.id } });
      if (count === 0) return { message: "Vendor not found." };
      savedId = id;
    } else {
      const vendor = await db.chipLabVendor.create({ data: { ...data, createdById: user.id } });
      savedId = vendor.id;
    }
    await logActivity({
      action: id ? "vendor.update" : "vendor.create",
      userId: user.id,
      entity: "ChipLabVendor",
      entityId: savedId,
      detail: name,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(SERVICE_PATHS.vendors);
  redirect(`${SERVICE_PATHS.vendors}?saved=${Date.now()}${id ? "" : `&highlight=${savedId}`}`);
}

export async function toggleVendorActive(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SERVICE_PATHS.vendors, "canEdit");
    const vendor = await db.chipLabVendor.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!vendor) return { ok: false, message: "Vendor not found." };
    await db.chipLabVendor.update({
      where: { id },
      data: { isActive: !vendor.isActive, updatedById: user.id },
    });
    await logActivity({
      action: "vendor.toggle",
      userId: user.id,
      entity: "ChipLabVendor",
      entityId: id,
      detail: `${vendor.isActive ? "Deactivated" : "Reactivated"}: ${vendor.name}`,
    });
    revalidatePath(SERVICE_PATHS.vendors);
    return { ok: true, message: vendor.isActive ? "Vendor deactivated." : "Vendor reactivated." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
