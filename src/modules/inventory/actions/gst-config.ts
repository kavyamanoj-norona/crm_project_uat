"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { GST_RATES } from "../billing-schema";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { DEFAULT_USID_CONFIG, GST_CONFIG_FIELDS, gstRatesSchema } from "../usid-schema";

const label = (rates: readonly number[]) => rates.map((r) => `${r}%`).join(", ");

/**
 * Sets the GST rates offered on purchase bill lines. Only Admin and the Purchase Manager. Bills already saved keep
 * the rate they were saved with. The change is written to the user activity log (previous value, new value).
 */
export async function saveGstRates(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = gstRatesSchema.safeParse(pick(formData, GST_CONFIG_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const rates = parsed.data.gstRates;

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.configuration, "canEdit");
    requirePurchaseManager(user);

    const before = await db.inventoryConfig.findUnique({ where: { id: "default" }, select: { gstRates: true } });
    const previous = before && before.gstRates.length > 0 ? before.gstRates : [...GST_RATES];
    if (previous.join() === rates.join()) return { message: "Those are already the configured GST rates." };

    await db.inventoryConfig.upsert({
      where: { id: "default" },
      update: { gstRates: rates, updatedById: user.id },
      create: { id: "default", ...DEFAULT_USID_CONFIG, gstRates: rates, updatedById: user.id },
    });
    await logActivity({
      action: "inventory.gst-config",
      userId: user.id,
      entity: "InventoryConfig",
      entityId: "default",
      detail: `GST rates changed from ${label(previous)} to ${label(rates)}`,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(INVENTORY_PATHS.configuration);
  revalidatePath(INVENTORY_PATHS.billing, "layout");
  return { ok: true, message: "GST rates saved." };
}
