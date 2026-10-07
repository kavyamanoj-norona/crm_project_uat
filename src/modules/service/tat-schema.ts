import { z } from "zod";
import { enumOptions } from "@/lib/enum";
import type { CaseStatus } from "@/generated/prisma/client";

export const TAT_STAGES: CaseStatus[] = [
  "INTAKE", "DIAGNOSIS", "PENDING_APPROVAL",
  "AWAITING_STOCK", "QUALITY_CHECK", "READY_FOR_DELIVERY",
];

export const TAT_UNITS = ["MINUTES", "HOURS", "DAYS"] as const;
export const TAT_UNIT_LABELS = { MINUTES: "Minutes", HOURS: "Hours", DAYS: "Days" };
export const tatUnitOptions = enumOptions(TAT_UNITS, TAT_UNIT_LABELS);

export const tatConfigSchema = z.object({
  status: z.string().min(1, "Status is required"),
  targetValue: z.coerce.number({ error: "Enter a number" }).int().min(1, "Must be at least 1").max(9999),
  targetUnit: z.enum(TAT_UNITS, { error: "Select a unit" }),
  warningThreshold: z.coerce.number({ error: "Enter a percentage" }).int().min(1).max(99),
  escalationThreshold: z.coerce.number({ error: "Enter a percentage" }).int().min(1).max(999),
  isActive: z.enum(["yes", "no"]).transform((v) => v === "yes"),
  remarks: z.string().trim().transform((v) => v === "" ? null : v).pipe(z.string().max(500).nullable()),
});

export type TatConfigInput = z.output<typeof tatConfigSchema>;

export const TAT_CONFIG_FIELDS = Object.keys(tatConfigSchema.shape);
