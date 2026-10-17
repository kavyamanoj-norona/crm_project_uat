import { z } from "zod";

/** Units a warranty can be measured in. */
export const WARRANTY_UNITS = ["DAY", "WEEK", "MONTH", "YEAR"] as const;
export type WarrantyUnitValue = (typeof WARRANTY_UNITS)[number];

export const WARRANTY_UNIT_LABELS: Record<WarrantyUnitValue, { one: string; many: string }> = {
  DAY: { one: "day", many: "days" },
  WEEK: { one: "week", many: "weeks" },
  MONTH: { one: "month", many: "months" },
  YEAR: { one: "year", many: "years" },
};

/** The longest warranty each unit allows (about ten years). */
const MAX_BY_UNIT: Record<WarrantyUnitValue, number> = { DAY: 3650, WEEK: 520, MONTH: 120, YEAR: 10 };

/** "6 months", "1 year": the name people pick on purchase bills, made from the duration. */
export const warrantyName = (value: number, unit: WarrantyUnitValue) =>
  `${value} ${value === 1 ? WARRANTY_UNIT_LABELS[unit].one : WARRANTY_UNIT_LABELS[unit].many}`;

/** A reusable warranty period: a number and a unit (days, weeks, months or years). */
export const warrantySchema = z
  .object({
    durationValue: z.coerce
      .number({ message: "Enter the duration" })
      .int("Duration must be a whole number")
      .min(1, "Duration must be at least 1"),
    durationUnit: z.enum(WARRANTY_UNITS, { error: "Select days, weeks, months or years" }),
  })
  .superRefine((v, ctx) => {
    const max = MAX_BY_UNIT[v.durationUnit];
    if (v.durationValue > max)
      ctx.addIssue({ code: "custom", path: ["durationValue"], message: `Can't be more than ${max} ${WARRANTY_UNIT_LABELS[v.durationUnit].many}` });
  });

export const WARRANTY_FIELDS = Object.keys(warrantySchema.shape);

/** Warranty end date: the bill date plus the duration; a month or year step stops at the last day of a shorter month. */
export function warrantyEnd(billDate: Date, value: number, unit: WarrantyUnitValue): Date {
  const d = new Date(billDate);
  if (unit === "DAY" || unit === "WEEK") {
    d.setUTCDate(d.getUTCDate() + value * (unit === "WEEK" ? 7 : 1));
    return d;
  }
  const months = unit === "YEAR" ? value * 12 : value;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

/** Rough length in days, only to order warranties from shortest to longest. */
export const warrantyApproxDays = (value: number, unit: WarrantyUnitValue) =>
  value * (unit === "DAY" ? 1 : unit === "WEEK" ? 7 : unit === "MONTH" ? 30 : 365);
