import { z } from "zod";
import { optionalDate, optionalText, requiredText } from "@/lib/form";
import { enumOptions, requiredEnum } from "@/lib/enum";
import { optionalRupees } from "@/lib/money";
import { optionalPhone, requiredPhone } from "@/lib/phone";
import { todayIst } from "@/lib/dates";
import { LEAD_SOURCES } from "@/modules/customers/schemas";

// ─── Enums (mirror prisma/schema.prisma) ─────────────────────────────────────

export const INTAKE_TYPES = ["WALK_IN", "PICKUP", "ON_SITE"] as const;
export const INTAKE_TYPE_LABELS = { WALK_IN: "Walk-in", PICKUP: "Pickup", ON_SITE: "On-site" };

export const PRODUCT_TYPES = ["LAPTOP", "PRINTER", "DESKTOP", "OTHER"] as const;

export const WARRANTY_STATUSES = ["NON_WARRANTY", "WARRANTY", "RETURN"] as const;
export const WARRANTY_LABELS = { NON_WARRANTY: "Non-warranty", WARRANTY: "Warranty", RETURN: "Return" };

export const PAYMENT_MODES = ["UPI", "CASH", "CARD", "OTHER"] as const;
export const PAYMENT_MODE_LABELS = { UPI: "UPI", CASH: "Cash", CARD: "Card", OTHER: "Other" };

export const ITEM_CONDITIONS = ["GOOD", "FAIR", "WORN", "DAMAGED"] as const;
export type ItemConditionValue = (typeof ITEM_CONDITIONS)[number];

export const CASE_STATUSES = [
  "INTAKE",
  "DIAGNOSIS",
  "PENDING_APPROVAL",
  "AWAITING_STOCK",
  "QUALITY_CHECK",
  "READY_FOR_DELIVERY",
  "CLOSED",
  "CANCELLED",
] as const;
export type CaseStatusValue = (typeof CASE_STATUSES)[number];

export const CASE_STATUS_LABELS: Record<CaseStatusValue, string> = {
  INTAKE: "Intake",
  DIAGNOSIS: "Diagnosis",
  PENDING_APPROVAL: "Pending approval",
  AWAITING_STOCK: "Awaiting stock",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready for delivery",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const CASE_STATUS_TONE = {
  INTAKE: "navy",
  DIAGNOSIS: "primary",
  PENDING_APPROVAL: "violet",
  AWAITING_STOCK: "warning",
  QUALITY_CHECK: "indigo",
  READY_FOR_DELIVERY: "success",
  CLOSED: "neutral",
  CANCELLED: "danger",
} as const satisfies Record<CaseStatusValue, string>;

/** The normal path of a case, in order (Cancelled sits outside it). */
export const CASE_FLOW: CaseStatusValue[] = CASE_STATUSES.filter((s) => s !== "CANCELLED");

/** The stage after `status` on the normal path, or null at the end / when cancelled. */
export function nextStage(status: CaseStatusValue): CaseStatusValue | null {
  const i = CASE_FLOW.indexOf(status);
  return i >= 0 && i < CASE_FLOW.length - 1 ? CASE_FLOW[i + 1]! : null;
}

export const isOpenStatus = (s: CaseStatusValue) => s !== "CLOSED" && s !== "CANCELLED";

/** What kind of job it is, from the warranty status: "Paid repair" … */
export const CASE_KIND_LABELS = { NON_WARRANTY: "Paid repair", WARRANTY: "Warranty repair", RETURN: "Warranty rework" };

export const intakeTypeOptions = enumOptions(INTAKE_TYPES, INTAKE_TYPE_LABELS);
export const productTypeOptions = enumOptions(PRODUCT_TYPES);
export const warrantyOptions = enumOptions(WARRANTY_STATUSES, WARRANTY_LABELS);
export const paymentModeOptions = enumOptions(PAYMENT_MODES, PAYMENT_MODE_LABELS);
export const conditionOptions = enumOptions(ITEM_CONDITIONS);

// ─── Intake form ─────────────────────────────────────────────────────────────

export const receivedItemSchema = z.object({
  name: requiredText("Item name"),
  referenceNo: optionalText,
  condition: z.enum(ITEM_CONDITIONS, { error: "Select the item's condition" }),
});
export type ReceivedItem = z.input<typeof receivedItemSchema>;

/** The repeatable "Received items" list travels as one JSON field. */
const receivedItems = z
  .string()
  .transform((v, ctx) => {
    if (v.trim() === "") return [];
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Received items could not be read" });
      return z.NEVER;
    }
  })
  .pipe(z.array(receivedItemSchema).max(20, "Up to 20 received items"));

const coordinate = (limit: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && Math.abs(v) <= limit), "Invalid location");

const CROSS_FIELDS = ["intakeType", "siteAddress"];

const advanceModeField = z
  .string()
  .optional()
  .default("")
  .transform((v) => (v === "" ? null : v))
  .pipe(z.enum(PAYMENT_MODES).nullable());

export const intakeSchema = z
  .object({
    branchId: requiredText("Branch"),
    intakeType: requiredEnum(INTAKE_TYPES, "Intake type"),
    // 1 · Customer
    phone: requiredPhone(),
    name: requiredText("Name"),
    email: z.string().trim().toLowerCase().min(1, "Email is required").pipe(z.email("Enter a valid email")),
    altPhone: optionalPhone,
    accountId: optionalText,
    source: requiredEnum(LEAD_SOURCES, "How they heard about us"),
    // 2 · Product
    productType: requiredEnum(PRODUCT_TYPES, "Product type"),
    brand: requiredText("Brand"),
    model: optionalText,
    serialNo: optionalText,
    warrantyStatus: requiredEnum(WARRANTY_STATUSES, "Status"),
    devicePassword: z
      .string()
      .max(100, "Passcode is too long")
      .transform((v) => (v.trim() === "" ? null : v)),
    problemReported: requiredText("Problem reported"),
    receivedItems,
    // Pickup / on-site
    siteAddress: optionalText,
    siteLatitude: coordinate(90),
    siteLongitude: coordinate(180),
    // Advance payment (optional)
    advanceAmount: optionalRupees("Advance payment"),
    advanceMode: advanceModeField,
  })
  .superRefine((v, ctx) => {
    if (v.intakeType !== "WALK_IN" && !v.siteAddress)
      ctx.addIssue({ code: "custom", path: ["siteAddress"], message: "Address is required for pickup and on-site cases" });
    if (v.advanceAmount && !v.advanceMode)
      ctx.addIssue({ code: "custom", path: ["advanceMode"], message: "Select a payment mode for the advance" });
  }, {
    // Run alongside other field errors (so everything shows in one pass), as
    // long as the fields these rules read parsed cleanly.
    when: (payload) => !payload.issues.some((i) => CROSS_FIELDS.includes(String(i.path?.[0]))),
  });

export type IntakeInput = z.output<typeof intakeSchema>;

// ─── Estimate (items picked at diagnosis) ────────────────────────────────────

/** One billable line as the estimate dialog sends it. */
export const estimateLineSchema = z.object({
  itemId: requiredText("Item"),
  quantity: z.coerce.number({ error: "Enter a quantity" }).int("Quantity must be a whole number").min(1, "Quantity must be at least 1").max(999),
  unitPrice: optionalRupees("Price").refine((v) => v !== null && v > 0, "Enter a price"),
});
export type EstimateLine = { itemId: string; quantity: string; unitPrice: string };

const estimateLines = z
  .string()
  .transform((v, ctx) => {
    if (v.trim() === "") return [];
    try {
      return JSON.parse(v) as unknown;
    } catch {
      ctx.addIssue({ code: "custom", message: "Items could not be read" });
      return z.NEVER;
    }
  })
  .pipe(z.array(estimateLineSchema).max(50, "Up to 50 items"))
  .refine((lines) => new Set(lines.map((l) => l.itemId)).size === lines.length, "Each item can be added once — change its quantity instead");

/** "Start diagnosis" and "Edit items": engineer, items and delivery promise. */
export const estimateSchema = z
  .object({
    engineerId: requiredText("Engineer"),
    expectedDeliveryDate: optionalDate.refine(
      (d) => d === null || d.toISOString().slice(0, 10) >= todayIst(),
      "Expected delivery can't be in the past",
    ),
    gstInvoiceRequired: z.enum(["no", "yes"]).transform((v) => v === "yes"),
    note: optionalText.refine((v) => v === null || v.length <= 500, "Keep the note under 500 characters"),
    items: estimateLines,
    // Advance payment (optional)
    advanceAmount: optionalRupees("Advance payment"),
    advanceMode: advanceModeField,
  })
  .superRefine((v, ctx) => {
    if (v.advanceAmount && !v.advanceMode)
      ctx.addIssue({ code: "custom", path: ["advanceMode"], message: "Select a payment mode for the advance" });
  });
export type EstimateInput = z.output<typeof estimateSchema>;

/** Stages in which the items can still be changed (before the customer approves). */
export const ESTIMATE_EDITABLE: CaseStatusValue[] = ["DIAGNOSIS", "PENDING_APPROVAL"];

// ─── Stage changes ───────────────────────────────────────────────────────────

export const stageChangeSchema = z.object({
  toStatus: z.enum(CASE_FLOW as [CaseStatusValue, ...CaseStatusValue[]], { error: "Pick a stage" }),
  note: optionalText.refine((v) => v === null || v.length <= 500, "Keep the note under 500 characters"),
});

export const cancelSchema = z.object({
  reason: requiredText("Reason").pipe(z.string().min(5, "Give a short reason (at least 5 characters)").max(500)),
});

export const INTAKE_FIELDS = Object.keys(intakeSchema.shape);

export const INTAKE_LABELS: Record<string, string> = { jobsheetNo: "Jobsheet number", phone: "Phone" };

// ─── Feedback ─────────────────────────────────────────────────────────────────

export const CUSTOMER_BEHAVIOURS = ["COOPERATIVE", "NORMAL", "DIFFICULT", "RUDE", "EXCELLENT"] as const;
export type CustomerBehaviourValue = (typeof CUSTOMER_BEHAVIOURS)[number];

export const CUSTOMER_BEHAVIOUR_LABELS: Record<CustomerBehaviourValue, string> = {
  COOPERATIVE: "Cooperative",
  NORMAL: "Normal",
  DIFFICULT: "Difficult",
  RUDE: "Rude",
  EXCELLENT: "Excellent",
};

export const CUSTOMER_BEHAVIOUR_TONE: Record<CustomerBehaviourValue, string> = {
  COOPERATIVE: "success",
  NORMAL: "neutral",
  DIFFICULT: "warning",
  RUDE: "danger",
  EXCELLENT: "primary",
} as const;

export const feedbackSchema = z.object({
  rating: z.coerce
    .number({ error: "Select a rating" })
    .int()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: optionalText.refine((v) => v === null || v.length <= 1000, "Keep the comment under 1000 characters"),
  customerBehaviour: z.enum(CUSTOMER_BEHAVIOURS, { error: "Select customer behaviour" }),
});

/** What the phone lookup returns to the intake form. */
export type CustomerMatch = {
  id: string;
  code: string;
  name: string;
  email: string | null;
  altPhone: string | null;
  type: "INDIVIDUAL" | "BUSINESS";
  visitCount: number;
  isActive: boolean;
};
