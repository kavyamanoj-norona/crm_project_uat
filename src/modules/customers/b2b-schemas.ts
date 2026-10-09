import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/lib/form";
import { optionalPhone, requiredPhone } from "@/lib/phone";
import { optionalGstin } from "./schemas";

/** A B2B account is a customer of type BUSINESS; the type itself is fixed by the server. */
export const b2bSchema = z.object({
  name: requiredText("Business name"),
  contactPerson: optionalText,
  phone: requiredPhone(),
  altPhone: optionalPhone,
  email: optionalEmail,
  gstin: optionalGstin,
  address: optionalText,
  state: optionalText,
  district: optionalText,
  pincode: optionalText.refine((v) => v === null || /^\d{6}$/.test(v), "PIN code is 6 digits"),
  notes: optionalText,
});

export type B2bInput = z.output<typeof b2bSchema>;

export const B2B_FIELDS = Object.keys(b2bSchema.shape);

export const B2B_LABELS: Record<string, string> = {
  name: "Business name",
  contactPerson: "Contact person",
  phone: "Phone",
  altPhone: "Alt phone",
  email: "Email",
  gstin: "GSTIN",
  address: "Address",
  state: "State",
  district: "District",
  pincode: "PIN code",
  notes: "Notes",
  code: "Customer code",
};
