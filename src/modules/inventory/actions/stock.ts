"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { toFieldErrors, pick, type FormState } from "@/lib/form";
import { requireActionPermission } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";
import { INVENTORY_PATHS } from "../paths";
import { stockAdjustSchema } from "../schemas";

export async function adjustStock(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["itemId", "quantity", "unitCodes"]);
  const parsed = stockAdjustSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  const scope = await getBranchScope(user);
  const branchId = scope.branchId ?? (formData.get("branchId") as string | null);
  if (!branchId) return { ok: false, message: "Select a branch first using the header switcher." };

  const { itemId, quantity, unitCodes } = parsed.data;
  const codes = unitCodes ? unitCodes.split(",").map((c) => c.trim()).filter(Boolean) : [];

  await db.stockItem.upsert({
    where: { branchId_itemId: { branchId, itemId } },
    create: { branchId, itemId, quantity, unitCodes: codes, updatedById: user.id },
    update: { quantity, unitCodes: codes, updatedById: user.id },
  });

  revalidatePath(INVENTORY_PATHS.stock);
  redirect(`${INVENTORY_PATHS.stock}?saved=${Date.now()}`);
}
