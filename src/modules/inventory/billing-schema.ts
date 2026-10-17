import { z } from "zod";

// Purchase-bill rules shared by the review form (browser) and the confirm action
// (server). Money is integer paise; amounts typed by people arrive as rupee strings.

export const BILL_PAYMENT_MODES = ["CASH", "UPI", "CARD", "OTHER"] as const;
export const BILL_PAYMENT_MODE_LABELS: Record<(typeof BILL_PAYMENT_MODES)[number], string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

/** The GST rates offered when nothing has been configured (Inventory → Configuration). */
export const GST_RATES = [0, 5, 12, 18, 28] as const;

/** "7,500" / "7500.50" → paise; "" → 0; invalid → null. `signed` allows a leading minus (round-off). */
export function parseRupees(input: string, signed = false): number | null {
  const v = input.replace(/[,\s₹]/g, "");
  const m = (signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/).exec(v);
  if (v === "") return 0;
  if (!m) return null;
  const neg = v.startsWith("-");
  const [whole, frac = ""] = v.replace("-", "").split(".");
  const paise = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return neg ? -paise : paise;
}

export type BillLineAmounts = { grossPaise: number; discountPaise: number; taxablePaise: number; taxPaise: number; lineTotalPaise: number };

/** Integer-only line maths: GST is charged on the amount after discount, rounded half-up per line. */
export function lineAmounts(quantity: number, unitCostPaise: number, gstPercent: number, discountPaise = 0): BillLineAmounts {
  const grossPaise = quantity * unitCostPaise;
  const discount = Math.min(Math.max(discountPaise, 0), grossPaise);
  const taxablePaise = grossPaise - discount;
  const taxPaise = Math.floor((taxablePaise * gstPercent + 50) / 100);
  return { grossPaise, discountPaise: discount, taxablePaise, taxPaise, lineTotalPaise: taxablePaise + taxPaise };
}

/** Discount amount (paise) for a percentage of a gross amount, rounded half-up. */
export const discountFromPercent = (grossPaise: number, percent: number) => Math.floor((grossPaise * percent + 50) / 100);

export function billTotals(lines: BillLineAmounts[], roundOffPaise: number) {
  const subtotalPaise = lines.reduce((s, l) => s + l.taxablePaise, 0);
  const taxPaise = lines.reduce((s, l) => s + l.taxPaise, 0);
  return { subtotalPaise, taxPaise, totalPaise: subtotalPaise + taxPaise + roundOffPaise };
}

/** Upper-case letters and digits only, so "inv/001" and "INV-001" count as the same bill. */
export const normalizeBillNo = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Today in IST as yyyy-mm-dd. */
export const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

const text = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} is too long`);
const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "Too long")
    .transform((v) => (v === "" ? null : v));

const rupees = (label: string, { signed = false, positive = false } = {}) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = parseRupees(v, signed);
      if (p === null) {
        ctx.addIssue({ code: "custom", message: `${label}: enter an amount like 7500 or 7500.50` });
        return z.NEVER;
      }
      if (positive && p <= 0) {
        ctx.addIssue({ code: "custom", message: `${label} must be more than 0` });
        return z.NEVER;
      }
      return p;
    });

/** A USID: letters, digits and - _ / . only, 3–40 characters. People may type their own or generate one. */
export const USID_PATTERN = /^[A-Z0-9][A-Z0-9\-_/.]{2,39}$/;
export const MAX_UNITS_PER_LINE = 1000;

export const NEW_ITEM_TYPES = ["PART", "ACCESSORY"] as const;
export const NEW_ITEM_TYPE_LABELS: Record<(typeof NEW_ITEM_TYPES)[number], string> = { PART: "Part", ACCESSORY: "Accessory" };

export const billLineSchema = z.object({
  // Either an existing catalog item, or `newItem` with a name to create one when the bill is saved.
  itemId: z.string().trim(),
  newItem: z.boolean(),
  newName: opt(150),
  newType: z.enum(NEW_ITEM_TYPES),
  // Name as printed on the bill (from the scan); falls back to the catalog item's name when saved.
  description: opt(200),
  hsnSac: opt(20),
  // Reusable warranty period picked beside the item; saved on every unit bought on the line.
  warrantyId: opt(40),
  quantity: z
    .string()
    .trim()
    .regex(/^\d+$/, "Enter a whole number")
    .transform(Number)
    .refine((n) => n >= 1 && n <= MAX_UNITS_PER_LINE, `Quantity must be between 1 and ${MAX_UNITS_PER_LINE}`),
  rate: rupees("Rate", { positive: true }),
  // Discount as typed: the amount is what is saved; the percent is only a typing aid and is not posted.
  discountAmt: rupees("Discount"),
  gstPercent: z
    .string()
    .trim()
    .regex(/^\d+$/, "Select GST")
    .transform(Number)
    .refine((n) => n <= 40, "GST can't be more than 40%"),
});

export const billSchema = z
  .object({
    // "existing": `supplierId` is picked from the list. "new": the supplier fields below create one.
    supplierMode: z.enum(["existing", "new"]),
    supplierId: opt(40),
    supplierName: z.string().trim().max(150, "Supplier name is too long"),
    supplierGstin: opt(20).transform((v) => (v ? v.toUpperCase() : v)),
    supplierState: opt(80),
    supplierPhone: opt(30),
    supplierEmail: opt(120).refine((v) => v === null || /^[^s@]+@[^s@]+.[^s@]+$/.test(v), "Enter a valid email"),
    supplierAddress: opt(300),
    billNo: text("Bill number", 60),
    billDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter the bill date")
      .refine((d) => d <= todayIst(), "Bill date can't be in the future"),
    lines: z.array(billLineSchema).min(1, "Add at least one item").max(100, "Too many items"),
    roundOff: rupees("Round off", { signed: true }),
    notes: opt(1000),
    // Office use: bought for the office, not for service stock. The purpose says what it is for.
    isOfficeUse: z.boolean(),
    officePurpose: opt(150),
    paymentAmount: rupees("Amount paid"),
    paymentMode: z.enum(BILL_PAYMENT_MODES).nullable(),
    paymentRef: opt(60),
    imageUrl: opt(300),
    imageHash: opt(80),
  })
  .superRefine((b, ctx) => {
    if (b.supplierMode === "existing" && !b.supplierId)
      ctx.addIssue({ code: "custom", path: ["supplierId"], message: "Select a supplier, or add a new one" });
    if (b.supplierMode === "new" && !b.supplierName)
      ctx.addIssue({ code: "custom", path: ["supplierName"], message: "Supplier name is required" });
    b.lines.forEach((l, i) => {
      if (!l.newItem && !l.itemId) ctx.addIssue({ code: "custom", path: ["lines", i, "itemId"], message: "Select an item, or add a new one" });
      if (l.newItem && !l.newName) ctx.addIssue({ code: "custom", path: ["lines", i, "newName"], message: "Enter the item name" });
    });
    if (b.isOfficeUse && !b.officePurpose)
      ctx.addIssue({ code: "custom", path: ["officePurpose"], message: "Enter what the office items are for" });
    const lines = b.lines.map((l) => lineAmounts(l.quantity, l.rate, l.gstPercent, l.discountAmt));
    b.lines.forEach((l, i) => {
      if (l.discountAmt > l.quantity * l.rate)
        ctx.addIssue({ code: "custom", path: ["lines", i, "discountAmt"], message: "Discount can't be more than the total" });
    });
    const { totalPaise } = billTotals(lines, b.roundOff);
    if (Math.abs(b.roundOff) > 10_000) ctx.addIssue({ code: "custom", path: ["roundOff"], message: "Round off can't be more than ₹100" });
    if (totalPaise <= 0) ctx.addIssue({ code: "custom", path: ["lines"], message: "Bill total must be more than 0" });
    if (b.paymentAmount > totalPaise)
      ctx.addIssue({ code: "custom", path: ["paymentAmount"], message: "Amount paid can't be more than the bill total" });
    if (b.paymentAmount > 0 && !b.paymentMode)
      ctx.addIssue({ code: "custom", path: ["paymentMode"], message: "Select the payment mode" });

  });

export type BillInput = z.infer<typeof billSchema>;

/** The form's raw string values, as posted in the `payload` field. */
export type BillFormValues = {
  supplierMode: "existing" | "new";
  supplierId: string;
  supplierName: string;
  supplierGstin: string;
  supplierState: string;
  supplierPhone: string;
  supplierEmail: string;
  supplierAddress: string;
  billNo: string;
  billDate: string;
  lines: {
    itemId: string;
    newItem: boolean;
    newName: string;
    newType: (typeof NEW_ITEM_TYPES)[number];
    description: string;
    hsnSac: string;
    warrantyId: string;
    quantity: string;
    rate: string;
    discountPct: string;
    discountAmt: string;
    gstPercent: string;
  }[];
  roundOff: string;
  notes: string;
  isOfficeUse: boolean;
  officePurpose: string;
  paymentAmount: string;
  paymentMode: string;
  paymentRef: string;
  imageUrl: string;
  imageHash: string;
};

/** Parses the raw form values; field errors are keyed by path, e.g. "lines.0.itemId". */
export function parseBill(values: BillFormValues) {
  const result = billSchema.safeParse({ ...values, paymentMode: values.paymentMode || null });
  if (result.success) return { data: result.data, errors: null };
  const errors: Record<string, string[]> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join(".") || "form";
    (errors[key] ??= []).push(issue.message);
  }
  return { data: null, errors };
}

export const billPaymentSchema = z.object({
  amount: rupees("Amount", { positive: true }),
  mode: z.enum(BILL_PAYMENT_MODES, { error: "Select the payment mode" }),
  referenceNo: opt(60),
  note: opt(300),
});

/** What the OCR step returns to prefill the review form (all strings, may be empty). */
export type ScannedBill = {
  supplierName: string;
  supplierGstin: string;
  supplierState: string;
  supplierEmail: string;
  supplierPhone: string;
  supplierAddress: string;
  billNo: string;
  billDate: string;
  roundOff: string;
  total: string; // total printed on the bill, for the "does it add up?" hint
  lines: { description: string; hsnSac: string; quantity: string; rate: string; gstPercent: string; itemId: string }[];
};
