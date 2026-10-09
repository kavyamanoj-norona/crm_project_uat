import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/lib/form";
import { requiredPhone } from "@/lib/phone";

export const vendorSchema = z.object({
  name: requiredText("Vendor name").pipe(
    z.string().min(2, "Name is too short").max(100),
  ),
  contactName: optionalText,
  phone: requiredPhone("Contact number"),
  email: optionalEmail,
  address: optionalText,
  remarks: optionalText.refine(
    (v) => v === null || v.length <= 500,
    "Keep remarks under 500 characters",
  ),
});

export type VendorInput = z.output<typeof vendorSchema>;

export const VENDOR_FIELDS = Object.keys(vendorSchema.shape);
