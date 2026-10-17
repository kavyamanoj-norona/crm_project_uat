import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/lib/form";

export const supplierSchema = z.object({
  name: requiredText("Supplier name").pipe(z.string().min(2, "Name is too short").max(150)),
  gstin: optionalText.transform((v) => (v ? v.toUpperCase() : v)),
  state: optionalText,
  // Free text: suppliers often print several numbers or a landline with STD code.
  phone: optionalText,
  email: optionalEmail,
  // Days after the bill date that a bill falls due. Blank = not specified.
  paymentTermDays: optionalText.refine((v) => v === null || (/^d{1,3}$/.test(v) && Number(v) <= 365), "Enter the days, 0 to 365"),
  address: optionalText.refine((v) => v === null || v.length <= 300, "Keep the address under 300 characters"),
});

export type SupplierInput = z.output<typeof supplierSchema>;

export const SUPPLIER_FIELDS = Object.keys(supplierSchema.shape);
