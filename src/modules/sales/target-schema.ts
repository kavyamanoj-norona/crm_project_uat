import { z } from "zod";

const optionalInt = (min: number, max: number) =>
  z.union([z.literal("").transform(() => undefined), z.coerce.number().int().min(min).max(max)]).optional();

export const targetSchema = z
  .object({
    branchIds: z.string().min(1, "Select at least one branch"), // comma-separated ids
    period: z.enum(["DAILY", "MONTHLY", "YEARLY"], "Select a period"),
    year: z.coerce.number("Select a year").int().min(2024).max(2100),
    month: optionalInt(1, 12),
    day: optionalInt(1, 31),
    targetRupees: z.coerce.number("Enter the target amount").int("Enter a whole amount").positive("Target must be a positive amount"),
  })
  .superRefine((d, ctx) => {
    if ((d.period === "MONTHLY" || d.period === "DAILY") && !d.month) {
      ctx.addIssue({ code: "custom", message: "Select a month", path: ["month"] });
    }
    if (d.period === "DAILY" && !d.day) {
      ctx.addIssue({ code: "custom", message: "Select a day", path: ["day"] });
    }
  });

export const TARGET_FIELDS = ["branchIds", "period", "year", "month", "day", "targetRupees"] as const;
