import { z } from "zod";
import { checkbox, optionalText, requiredText } from "@/lib/form";

export const RULE_VALUE_TYPES = ["NUMBER", "PERCENT", "HOURS", "MINUTES", "BOOLEAN", "TEXT"] as const;
export type RuleValueType = (typeof RULE_VALUE_TYPES)[number];

export const RULE_CATEGORIES = ["Pricing", "Tax", "Service TAT", "Security", "General"] as const;

export const ruleSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z][A-Z0-9_]{2,40}$/, "Code: UPPER_SNAKE_CASE, e.g. DISCOUNT_CAP_PERCENT"),
    name: requiredText("Name"),
    category: requiredText("Category"),
    valueType: z.enum(RULE_VALUE_TYPES, { error: "Select a value type" }),
    value: z.string().trim(),
    description: optionalText,
    isActive: checkbox,
  })
  .superRefine((r, ctx) => {
    const bad = (message: string) => ctx.addIssue({ code: "custom", path: ["value"], message });
    if (r.valueType === "BOOLEAN") {
      if (r.value !== "true" && r.value !== "false") bad("Value must be true or false");
      return;
    }
    if (r.valueType === "TEXT") {
      if (!r.value) bad("Value is required");
      return;
    }
    const n = Number(r.value);
    if (r.value === "" || !Number.isFinite(n) || n < 0) return bad("Enter a number of 0 or more");
    if (r.valueType === "PERCENT" && n > 100) bad("A percentage can't be more than 100");
  });

/** Human-readable value, e.g. "10%", "24 h", "Yes". */
export function formatRuleValue(valueType: string, value: string) {
  switch (valueType) {
    case "PERCENT":
      return `${value}%`;
    case "HOURS":
      return `${value} h`;
    case "MINUTES":
      return `${value} min`;
    case "BOOLEAN":
      return value === "true" ? "Yes" : "No";
    default:
      return value;
  }
}
