"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { INVENTORY_PATHS } from "../paths";
import { requirePurchaseManager } from "../purchase-access";
import { DEFAULT_USID_CONFIG, USID_CONFIG_FIELDS, formatUsid, usidConfigSchema } from "../usid-schema";

/**
 * Sets where USID numbering starts (prefix, width and first number). Only Admin and the Purchase Manager.
 * It only affects units bought from now on: no existing USID is touched, and a number that is already
 * taken is skipped when USIDs are issued. The change is written to the user activity log.
 */
export async function saveUsidConfig(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = usidConfigSchema.safeParse(pick(formData, USID_CONFIG_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { prefix, width, number } = parsed.data.startingUsid;

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.configuration, "canEdit");
    requirePurchaseManager(user);

    const before = await db.inventoryConfig.findUnique({ where: { id: "default" } });
    const prev = before ?? { ...DEFAULT_USID_CONFIG };
    const previousValue = formatUsid(prev.prefix, prev.width, prev.nextNumber);
    const newValue = formatUsid(prefix, width, number);
    if (before && previousValue === newValue) return { message: "That is already the current starting USID." };

    await db.inventoryConfig.upsert({
      where: { id: "default" },
      update: { prefix, width, nextNumber: number, updatedById: user.id },
      create: { id: "default", prefix, width, nextNumber: number, updatedById: user.id },
    });
    await logActivity({
      action: "inventory.usid-config",
      userId: user.id,
      entity: "InventoryConfig",
      entityId: "default",
      detail: `Starting USID changed from ${previousValue} to ${newValue}`,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }

  revalidatePath(INVENTORY_PATHS.configuration);
  return { ok: true, message: "USID configuration saved." };
}
