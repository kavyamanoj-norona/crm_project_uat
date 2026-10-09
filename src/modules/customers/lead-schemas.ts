import { z } from "zod";
import { optionalEmail, optionalText, requiredText } from "@/lib/form";
import { optionalEnum } from "@/lib/enum";
import { requiredPhone } from "@/lib/phone";
import { LEAD_ENTRY_SOURCES } from "./schemas";

/** Name, mobile number and purpose are mandatory; everything else is optional. */
export const leadSchema = z.object({
  name: requiredText("Name"),
  phone: requiredPhone("Mobile number"),
  purpose: requiredText("Purpose").pipe(z.string().max(500, "Keep the purpose under 500 characters")),
  email: optionalEmail,
  source: optionalEnum(LEAD_ENTRY_SOURCES),
  notes: optionalText,
});

export type LeadInput = z.output<typeof leadSchema>;

export const LEAD_FIELDS = Object.keys(leadSchema.shape);

export const LEAD_LABELS: Record<string, string> = {
  name: "Name",
  phone: "Mobile number",
  purpose: "Purpose",
  email: "Email",
  source: "Source",
  notes: "Notes",
  code: "Lead ID",
};
