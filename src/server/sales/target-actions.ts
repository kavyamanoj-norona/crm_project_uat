"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { SALES_PATHS } from "@/modules/sales/paths";
import { formValues, pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { TARGET_FIELDS, targetSchema } from "@/modules/sales/target-schema";

// ─── saveSalesTarget ─────────────────────────────────────────────────────────

/** Create targets for one or more branches, or (with `id`) edit a single target. */
export async function saveSalesTarget(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = formData.get("id")?.toString() || null;
  const parsed = targetSchema.safeParse(pick(formData, TARGET_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const user = await requireActionPermission(SALES_PATHS.target, id ? "canEdit" : "canCreate");
  const { branchIds, period, year, month, day, targetRupees } = parsed.data;
  const targetPaise = targetRupees * 100;
  const where = { period, year, month: period === "YEARLY" ? null : (month ?? null), day: period === "DAILY" ? (day ?? null) : null };

  if (id) {
    const clash = await db.salesTarget.findFirst({
      where: { ...where, branchId: branchIds, id: { not: id } },
      select: { id: true },
    });
    if (clash) return { message: "A target already exists for this branch and date.", values: formValues(formData) };
    const { count } = await db.salesTarget.updateMany({ where: { id }, data: { ...where, targetPaise } });
    if (count === 0) return { message: "Target not found." };
  } else {
    const ids = branchIds.split(",").map((s) => s.trim()).filter(Boolean);
    // Prisma cannot upsert on compound unique keys that contain nullable columns (NULL != NULL in SQL).
    await Promise.all(
      ids.map(async (branchId) => {
        // isDelete in (0,1): also match a soft-deleted target so re-adding it revives the row.
        const existing = await db.salesTarget.findFirst({
          where: { ...where, branchId, isDelete: { in: [0, 1] } },
          select: { id: true },
        });
        if (existing) {
          await db.salesTarget.update({ where: { id: existing.id }, data: { targetPaise, isActive: true, isDelete: 0 } });
        } else {
          await db.salesTarget.create({ data: { ...where, branchId, targetPaise, createdById: user.id } });
        }
      }),
    );
  }

  revalidatePath(SALES_PATHS.target);
  redirect(`${SALES_PATHS.target}?saved=${Date.now()}`);
}

// ─── deleteSalesTarget ────────────────────────────────────────────────────────

export async function deleteSalesTarget(id: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(SALES_PATHS.target, "canDelete");
    const { count } = await db.salesTarget.updateMany({ where: { id }, data: { isDelete: 1 } });
    if (count === 0) return { ok: false, message: "Target not found." };
    await logActivity({ action: "sales-target.delete", userId: user.id, entity: "SalesTarget", entityId: id });
    revalidatePath(SALES_PATHS.target);
    return { ok: true, message: "Target deleted." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}
