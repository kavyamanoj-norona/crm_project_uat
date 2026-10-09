import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/lib/form";
import { enumOptions, optionalEnum, requiredEnum } from "@/lib/enum";
import { optionalPhone, requiredPhone } from "@/lib/phone";

/** A customer who has visited this many times or more is a VIP. */
export const VIP_MIN_VISITS = 2;

/** "Visits" filter on the customer list: query value → minimum visit count. */
export const VISIT_FILTERS = [
  { value: "", label: "All visits", min: 0 },
  { value: "2", label: "2 or more visits (VIP)", min: 2 },
  { value: "3", label: "3 or more visits", min: 3 },
  { value: "5", label: "5 or more visits", min: 5 },
] as const;

export const CUSTOMER_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export const CUSTOMER_TYPE_LABELS = { INDIVIDUAL: "Individual", BUSINESS: "Business (B2B)" };

export const LEAD_SOURCES = [
  "REPEAT_CUSTOMER",
  "WALK_IN",
  "REFERRAL",
  "ADVERTISEMENT",
  "SOCIAL_MEDIA",
  "GOOGLE_SEARCH",
  "OTHER",
] as const;
export type LeadSourceValue = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSourceValue | "WEBSITE", string> = {
  REPEAT_CUSTOMER: "Repeat customer",
  WALK_IN: "Walk-in / passing by",
  REFERRAL: "Referral",
  ADVERTISEMENT: "Saw an ad",
  SOCIAL_MEDIA: "Social media",
  GOOGLE_SEARCH: "Google search",
  OTHER: "Other",
  WEBSITE: "Website enquiry",
};

export const leadSourceOptions = enumOptions(LEAD_SOURCES, LEAD_SOURCE_LABELS);

/** Sources a lead can have: the usual ones plus "Website enquiry" (set by the website feed). */
export const LEAD_ENTRY_SOURCES = [...LEAD_SOURCES, "WEBSITE"] as const;
export const leadEntrySourceOptions = enumOptions(LEAD_ENTRY_SOURCES, LEAD_SOURCE_LABELS);
export const customerTypeOptions = enumOptions(CUSTOMER_TYPES, CUSTOMER_TYPE_LABELS);

export const optionalGstin = optionalText
  .transform((v) => v?.toUpperCase() ?? null)
  .refine((v) => v === null || /^[0-9]{2}[A-Z0-9]{13}$/.test(v), "GSTIN must be 15 characters");

export const customerSchema = z.object({
  type: requiredEnum(CUSTOMER_TYPES, "Customer type"),
  name: requiredText("Name"),
  phone: requiredPhone(),
  altPhone: optionalPhone,
  email: optionalEmail,
  gstin: optionalGstin,
  source: optionalEnum(LEAD_ENTRY_SOURCES),
  address: optionalText,
  state: optionalText,
  district: optionalText,
  pincode: optionalText.refine((v) => v === null || /^\d{6}$/.test(v), "PIN code is 6 digits"),
  notes: optionalText,
});

export type CustomerInput = z.output<typeof customerSchema>;

export const CUSTOMER_FIELDS = Object.keys(customerSchema.shape);

/** Field labels for "Changed: name, email" history entries and duplicate errors. */
export const CUSTOMER_LABELS: Record<string, string> = {
  type: "Type",
  name: "Name",
  phone: "Phone",
  altPhone: "Alt phone",
  email: "Email",
  gstin: "GSTIN",
  source: "Source",
  address: "Address",
  state: "State",
  district: "District",
  pincode: "PIN code",
  notes: "Notes",
  code: "Customer code",
};
