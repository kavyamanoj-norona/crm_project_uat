import { z } from "zod";
import { optionalText } from "@/lib/form";
import { enumOptions, optionalEnum } from "@/lib/enum";
import { CALL_OUTCOMES, CALL_OUTCOME_LABELS, LEAD_STATUSES, LEAD_STATUS_LABELS } from "./status";

export const leadStatusOptions = enumOptions(LEAD_STATUSES, LEAD_STATUS_LABELS);
export const callOutcomeOptions = enumOptions(CALL_OUTCOMES, CALL_OUTCOME_LABELS);

/** <input type="datetime-local"> value (IST wall time, "2026-10-19T14:30") → Date; empty → null. */
export const optionalDateTime = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return null;
    const d = new Date(`${v.length === 16 ? `${v}:00` : v}+05:30`);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) || Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date and time" });
      return z.NEVER;
    }
    return d;
  });

/** Rupees typed in a form ("1,250.50") → paise; empty → null. */
export const optionalRupeesPaise = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const t = v.replace(/[,\s₹]/g, "");
    if (t === "") return null;
    if (!/^-?\d+(\.\d{1,2})?$/.test(t)) {
      ctx.addIssue({ code: "custom", message: "Enter an amount in rupees" });
      return z.NEVER;
    }
    const neg = t.startsWith("-");
    const [whole, frac = ""] = t.replace("-", "").split(".");
    const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    return neg ? -paise : paise;
  });

/** One call about a lead: what happened, what was said, when to call again. */
export const callSchema = z.object({
  outcome: z.enum(CALL_OUTCOMES, { error: "Select the call outcome" }),
  remarks: optionalText.pipe(z.string().max(1000, "Keep the remarks under 1000 characters").nullable()),
  nextFollowUpAt: optionalDateTime,
  status: optionalEnum(LEAD_STATUSES),
});
export const CALL_FIELDS = Object.keys(callSchema.shape);

const rupees = (label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const t = v.replace(/[,\s₹]/g, "");
      if (!/^\d+(\.\d{1,2})?$/.test(t)) {
        ctx.addIssue({ code: "custom", message: `Enter ${label} in rupees` });
        return z.NEVER;
      }
      const [whole, frac = ""] = t.split(".");
      return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    });

export const servicePriceSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the issue or repair type").max(120, "Keep the name under 120 characters"),
    productType: optionalEnum(["LAPTOP", "PRINTER", "DESKTOP", "OTHER"] as const),
    min: rupees("the lowest price"),
    max: rupees("the highest price"),
    notes: optionalText.pipe(z.string().max(300, "Keep the notes under 300 characters").nullable()),
  })
  .refine((v) => v.max >= v.min, { message: "The highest price can't be below the lowest", path: ["max"] });
export const SERVICE_PRICE_FIELDS = ["name", "productType", "min", "max", "notes"] as const;

export const INCENTIVE_BASES = ["PER_CONVERSION", "PER_BILLING", "MARGIN_PERCENT"] as const;
export const INCENTIVE_BASIS_LABELS = { PER_CONVERSION: "Per conversion (flat)", PER_BILLING: "Per billing (flat)", MARGIN_PERCENT: "% of billing margin" } as const;
export const incentiveBasisOptions = enumOptions(INCENTIVE_BASES, INCENTIVE_BASIS_LABELS);

export const incentiveRuleSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a rule name").max(80, "Keep the name under 80 characters"),
    basis: z.enum(INCENTIVE_BASES, { error: "Select how it is earned" }),
    amount: z.string().trim(),
    percent: z.string().trim(),
    minMargin: z.string().trim(),
    effectiveFrom: z.iso.date("Enter the start date"),
  })
  .superRefine((v, ctx) => {
    const num = (s: string) => (s === "" ? null : /^\d+(\.\d{1,2})?$/.test(s.replace(/[,\s₹]/g, "")) ? Number(s.replace(/[,\s₹]/g, "")) : NaN);
    if (v.basis === "MARGIN_PERCENT") {
      const p = num(v.percent);
      if (p === null || Number.isNaN(p) || p <= 0 || p > 100) ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter a percentage between 0 and 100" });
      if (v.minMargin !== "" && Number.isNaN(num(v.minMargin))) ctx.addIssue({ code: "custom", path: ["minMargin"], message: "Enter an amount in rupees" });
    } else {
      const a = num(v.amount);
      if (a === null || Number.isNaN(a) || a <= 0) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the amount in rupees" });
    }
  });
export const INCENTIVE_RULE_FIELDS = ["name", "basis", "amount", "percent", "minMargin", "effectiveFrom"] as const;

export const targetSchema = z.object({
  userId: z.string().trim().min(1, "Select the telecaller"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month"),
  conversionsTarget: z.coerce.number({ message: "Enter the conversions target" }).int("Whole numbers only").min(0, "Can't be negative").max(100000),
  billingsTarget: z.coerce.number({ message: "Enter the billings target" }).int("Whole numbers only").min(0, "Can't be negative").max(100000),
});
export const TARGET_FIELDS = ["userId", "month", "conversionsTarget", "billingsTarget"] as const;
