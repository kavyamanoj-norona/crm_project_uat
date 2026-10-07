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

export async function consumeStockItem(id: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  const item = await db.stockItem.findUniqueOrThrow({ where: { id }, select: { quantity: true } });
  if (item.quantity <= 0) return;
  await db.stockItem.update({
    where: { id },
    data: { quantity: { decrement: 1 }, updatedById: user.id },
  });
  revalidatePath(INVENTORY_PATHS.stock);
}

export async function consumeItemFromCase(caseItemId: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  const line = await db.caseItem.findUniqueOrThrow({
    where: { id: caseItemId },
    select: { itemId: true, quantity: true, case: { select: { id: true, branchId: true } } },
  });
  const { itemId, quantity, case: { id: caseId, branchId } } = line;
  const existing = await db.stockItem.findUnique({
    where: { branchId_itemId: { branchId, itemId } },
    select: { quantity: true },
  });
  if (!existing || existing.quantity <= 0) return;
  await db.stockItem.update({
    where: { branchId_itemId: { branchId, itemId } },
    data: { quantity: { decrement: Math.min(quantity, existing.quantity) }, updatedById: user.id },
  });
  revalidatePath(`/service/cases/${caseId}`);
  revalidatePath(INVENTORY_PATHS.stock);
}
