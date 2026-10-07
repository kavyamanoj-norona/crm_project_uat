"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { toFieldErrors, pick, type FormState } from "@/lib/form";
import { requireActionPermission } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";
import { nextSequence } from "@/server/sequence";
import type { PurchaseRequestStatus } from "@/generated/prisma/client";
import { INVENTORY_PATHS } from "../paths";
import { purchaseRequestSchema } from "../schemas";

const periodFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "2-digit",
  month: "2-digit",
});

function period() {
  return periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");
}

export async function raisePurchaseRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["itemId", "quantity", "caseId", "notes"]);
  const parsed = purchaseRequestSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
  const scope = await getBranchScope(user);
  const branchId = scope.branchId ?? (formData.get("branchId") as string | null);
  if (!branchId) return { ok: false, message: "Select a branch first using the header switcher." };

  const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });
  const { itemId, quantity, caseId, notes } = parsed.data;

  await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `PR:${branch.code}:${period()}`);
    const code = `PR-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
    await tx.purchaseRequest.create({
      data: { code, branchId, itemId, quantity, caseId: caseId ?? null, notes: notes ?? null, requestedById: user.id },
    });
  });

  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
  redirect(`${INVENTORY_PATHS.purchasing}?saved=${Date.now()}`);
}

export async function requestPartForCase(caseItemId: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
  const line = await db.caseItem.findUniqueOrThrow({
    where: { id: caseItemId },
    select: { itemId: true, quantity: true, caseId: true, case: { select: { branchId: true } } },
  });
  const { itemId, quantity, caseId, case: { branchId } } = line;
  const branch = await db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } });

  await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, `PR:${branch.code}:${period()}`);
    const code = `PR-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
    await tx.purchaseRequest.create({
      data: { code, branchId, itemId, quantity, caseId, requestedById: user.id },
    });
  });

  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
  revalidatePath(`/service/cases/${caseId}`);
}

export async function receiveStock(purchaseRequestId: string): Promise<void> {
  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
  const pr = await db.purchaseRequest.findUniqueOrThrow({
    where: { id: purchaseRequestId },
    select: { branchId: true, itemId: true, quantity: true, status: true },
  });
  if (pr.status !== "APPROVED") return;

  await db.$transaction(async (tx) => {
    await tx.purchaseRequest.update({ where: { id: purchaseRequestId }, data: { status: "FULFILLED" } });
    await tx.stockItem.upsert({
      where: { branchId_itemId: { branchId: pr.branchId, itemId: pr.itemId } },
      create: { branchId: pr.branchId, itemId: pr.itemId, quantity: pr.quantity, unitCodes: [], updatedById: user.id },
      update: { quantity: { increment: pr.quantity }, updatedById: user.id },
    });
  });

  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
}

export async function updatePurchaseRequestStatus(
  id: string,
  status: Extract<PurchaseRequestStatus, "WITH_PM" | "APPROVED" | "REJECTED" | "FULFILLED">,
): Promise<void> {
  const needsApprove = status === "APPROVED" || status === "REJECTED";
  const user = await requireActionPermission(INVENTORY_PATHS.stock, needsApprove ? "canApprove" : "canEdit");
  await db.purchaseRequest.update({
    where: { id },
    data: {
      status,
      ...(needsApprove ? { reviewedById: user.id, reviewedAt: new Date() } : {}),
    },
  });
  revalidatePath(INVENTORY_PATHS.stock);
  revalidatePath(INVENTORY_PATHS.purchasing);
}
