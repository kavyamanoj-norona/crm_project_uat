"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { toFieldErrors, pick, type FormState } from "@/lib/form";
import { requireActionPermission } from "@/server/rbac/guard";
import { notify } from "@/server/notify/push";
import { getBranchScope } from "@/server/branch-scope";
import { nextSequence } from "@/server/sequence";
import type { TransferStatus } from "@/generated/prisma/client";
import { INVENTORY_PATHS } from "../paths";
import { stockTransferSchema } from "../schemas";

const periodFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  year: "2-digit",
  month: "2-digit",
});

function period() {
  return periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");
}

export async function createTransfer(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = pick(formData, ["toBranchId", "itemId", "quantity", "unitCodes", "notes"]);
  const parsed = stockTransferSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const user = await requireActionPermission(INVENTORY_PATHS.stock, "canCreate");
  const scope = await getBranchScope(user);
  const fromBranchId = scope.branchId ?? (formData.get("fromBranchId") as string | null);
  if (!fromBranchId) return { ok: false, message: "Select source branch using the header switcher." };

  const { toBranchId, itemId, quantity, unitCodes, notes } = parsed.data;
  if (toBranchId === fromBranchId) return { ok: false, message: "Source and destination must differ." };

  const [fromBranch, toBranch] = await Promise.all([
    db.branch.findUniqueOrThrow({ where: { id: fromBranchId }, select: { code: true } }),
    db.branch.findUniqueOrThrow({ where: { id: toBranchId }, select: { code: true } }),
  ]);

  const codes = unitCodes ? unitCodes.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const created = await db.$transaction(async (tx) => {
    const key = `TR:${fromBranch.code}-${toBranch.code}:${period()}`;
    const seq = await nextSequence(tx, key);
    const code = `TR-${fromBranch.code.toUpperCase()}-${toBranch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
    await tx.stockTransfer.create({
      data: {
        code,
        fromBranchId,
        toBranchId,
        notes: notes ?? null,
        createdById: user.id,
        items: { create: [{ itemId, quantity, unitCodes: codes }] },
      },
    });
    return code;
  });

  // The Purchase Manager sees every branch; nobody else is told.
  notify(
    { privileges: ["PURCHASE_MANAGER"], exceptUserId: user.id },
    { category: "INVENTORY", title: "Stock transfer requested", body: `${created}: ${fromBranch.code} → ${toBranch.code}`, url: INVENTORY_PATHS.purchasing, tag: `transfer-${created}` },
  );

  revalidatePath(INVENTORY_PATHS.stock);
  redirect(`${INVENTORY_PATHS.stock}?saved=${Date.now()}`);
}

export async function updateTransferStatus(
  id: string,
  status: Extract<TransferStatus, "APPROVED" | "DISPATCHED" | "RECEIVED" | "CANCELLED">,
): Promise<void> {
  const needsApprove = status === "APPROVED";
  const user = await requireActionPermission(INVENTORY_PATHS.stock, needsApprove ? "canApprove" : "canEdit");
  const now = new Date();
  const before = await db.stockTransfer.findUnique({ where: { id }, select: { code: true, toBranchId: true, fromBranchId: true, createdById: true } });
  await db.stockTransfer.update({
    where: { id },
    data: {
      status,
      ...(status === "APPROVED" ? { approvedById: user.id, approvedAt: now } : {}),
      ...(status === "DISPATCHED" ? { dispatchedAt: now } : {}),
      ...(status === "RECEIVED" ? { receivedAt: now } : {}),
    },
  });
  // Dispatched stock is announced only to the branch it is going to (Branch Manager and front desk).
  if (before && status === "DISPATCHED")
    notify(
      { privileges: ["BRANCH_MANAGER", "SALES"], branchId: before.toBranchId, exceptUserId: user.id },
      { category: "INVENTORY", title: "Stock dispatched to your branch", body: `${before.code} is on its way. Confirm when it arrives.`, url: INVENTORY_PATHS.stock, tag: `transfer-${before.code}` },
    );
  revalidatePath(INVENTORY_PATHS.stock);
}
