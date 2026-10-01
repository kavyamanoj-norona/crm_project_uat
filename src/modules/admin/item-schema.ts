import { z } from "zod";
import { checkbox, optionalText, requiredText } from "@/lib/form";
import { enumOptions, requiredEnum } from "@/lib/enum";
import { optionalRupees } from "@/lib/money";

export const ITEM_TYPES = ["SERVICE", "PART", "ACCESSORY"] as const;
export type ItemTypeValue = (typeof ITEM_TYPES)[number];
export const ITEM_TYPE_LABELS: Record<ItemTypeValue, string> = { SERVICE: "Service", PART: "Spare part", ACCESSORY: "Accessory" };
export const itemTypeOptions = enumOptions(ITEM_TYPES, ITEM_TYPE_LABELS);
export const ITEM_TYPE_TONE = { SERVICE: "primary", PART: "indigo", ACCESSORY: "violet" } as const satisfies Record<ItemTypeValue, string>;

export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const gstOptions = GST_RATES.map((r) => ({ value: String(r), label: `${r}%` }));

export const UNITS = ["Nos", "Set", "Hrs", "Job", "Mtr"] as const;
export const unitOptions = UNITS.map((u) => ({ value: u, label: u }));

const wholeNumber = (label: string, min: number, max: number, optional = false) =>
  z
    .string()
    .trim()
    .refine((v) => (optional && v === "") || /^\d+$/.test(v), `${label}: enter a whole number`)
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (v >= min && v <= max), `${label} must be ${min}–${max}`);

export const itemSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9\-_/.]{1,29}$/, "Code: 2–30 letters, digits, - _ / ."),
  name: requiredText("Name"),
  type: requiredEnum(ITEM_TYPES, "Type"),
  category: optionalText,
  brand: optionalText,
  unit: requiredText("Unit"),
  hsnSac: optionalText.refine((v) => v === null || /^\d{4,8}$/.test(v), "HSN/SAC is 4–8 digits"),
  gstPercent: z
    .string()
    .min(1, "Pick a GST rate")
    .transform(Number)
    .refine((v) => (GST_RATES as readonly number[]).includes(v), "Pick a GST rate"),
  price: optionalRupees("Price").refine((v) => v !== null && v > 0, "Price is required"),
  maxDiscountPercent: wholeNumber("Max discount", 0, 100).transform((v) => v ?? 0),
  warrantyDays: wholeNumber("Warranty", 0, 3650, true),
  description: optionalText,
  isActive: checkbox,
});

export type ItemInput = z.output<typeof itemSchema>;
