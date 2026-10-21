import { z } from "zod";
import { optionalDate, optionalText } from "@/lib/form";
import { optionalEnum } from "@/lib/enum";
import { leadSchema } from "@/modules/customers/lead-schemas";
import { INTAKE_TYPES } from "@/modules/service/case-schema";
import { optionalDateTime, optionalRupeesPaise } from "./schemas";
import { LEAD_STATUSES } from "./status";

/**
 * The Leads form: the customer-level lead fields plus the telecaller's tracking columns (service mode, appointment, status,
 * token, purchase cost, margin, walk-in and billing dates, sales person, telecaller). The website enquiry API keeps using
 * the smaller `leadSchema`.
 */
export const leadFormSchema = leadSchema.extend({
  branchId: optionalText,
  serviceMode: optionalEnum(INTAKE_TYPES),
  appointmentAt: optionalDateTime,
  status: optionalEnum(LEAD_STATUSES),
  tokenNo: optionalText.pipe(z.string().max(30, "Keep the token under 30 characters").nullable()),
  purchaseCost: optionalRupeesPaise,
  margin: optionalRupeesPaise,
  walkInDate: optionalDate,
  billingDate: optionalDate,
  salesPersonId: optionalText,
  assignedTelecallerId: optionalText,
});

export const LEAD_FORM_FIELDS = Object.keys(leadFormSchema.shape);
