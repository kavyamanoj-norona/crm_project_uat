"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionPermission } from "@/server/rbac/guard";
import { SALES_PATHS } from "@/modules/sales/paths";
import { pick, toFieldErrors, type FormState } from "@/lib/form";

// ─── Schema ──────────────────────────────────────────────────────────────────

const createTargetSchema = z
  .object({
    branchIds: z.string().min(1, "Select at least one branch"), // comma-separated ids from hidden input
    period: z.enum(["DAILY", "MONTHLY", "YEARLY"]),
    year: z.coerce.number().int().min(2024).max(2100),
    month: z.coerce
      .number()
      .int()
      .min(1)
      .max(12)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    day: z.coerce
      .number()
      .int()
      .min(1)
      .max(31)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    targetRupees: z.coerce.number().int().positive("Target must be a positive amount"),
  })
  .superRefine((d, ctx) => {
    if (d.period === "MONTHLY" && !d.month) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Month is required for monthly targets", path: ["month"] });
    }
    if (d.period === "DAILY" && !d.month) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Month is required for daily targets", path: ["month"] });
    }
    if (d.period === "DAILY" && !d.day) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Day is required for daily targets", path: ["day"] });
    }
  });

// ─── createSalesTargets ───────────────────────────────────────────────────────

export async function createSalesTargets(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionPermission(SALES_PATHS.target, "canCreate");

  const raw = pick(formData, ["branchIds", "period", "year", "month", "day", "targetRupees"]);
  const parsed = createTargetSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { branchIds, period, year, month, day, targetRupees } = parsed.data;
  const targetPaise = targetRupees * 100;
  const ids = branchIds.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0) return { ok: false, message: "Select at least one branch." };

  // Prisma cannot upsert on compound unique keys that contain nullable columns (NULL != NULL in SQL).
  // Use findFirst + create/update per branch instead.
  await Promise.all(
    ids.map(async (branchId) => {
      const existing = await db.salesTarget.findFirst({
        where: { branchId, period, year, month: month ?? null, day: day ?? null },
        select: { id: true },
      });
      if (existing) {
        await db.salesTarget.update({
          where: { id: existing.id },
          data: { targetPaise, isActive: true },
        });
      } else {
        await db.salesTarget.create({
          data: {
            branchId,
            period,
            year,
            month: month ?? null,
            day: day ?? null,
            targetPaise,
            createdById: user.id,
          },
        });
      }
    }),
  );

  revalidatePath(SALES_PATHS.target);
  return {
    ok: true,
    message: `Target set for ${ids.length} branch${ids.length > 1 ? "es" : ""}.`,
  };
}

// ─── deleteSalesTarget ────────────────────────────────────────────────────────

export async function deleteSalesTarget(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireActionPermission(SALES_PATHS.target, "canDelete");
  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing target ID." };

  await db.salesTarget.update({ where: { id }, data: { isActive: false } });
  revalidatePath(SALES_PATHS.target);
  return { ok: true, message: "Target removed." };
}
