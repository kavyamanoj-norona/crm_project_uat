import { z } from "zod";
import { optionalText, requiredText } from "@/lib/form";

export const stockAdjustSchema = z.object({
  itemId: requiredText("Item"),
  quantity: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
  unitCodes: optionalText,
});

export const purchaseRequestSchema = z.object({
  itemId: requiredText("Item"),
  caseId: optionalText,
  notes: optionalText,
});

/** Part request raised from a case line: model number required, notes optional (photos are checked on the file input). */
export const partRequestSchema = z.object({
  modelNo: requiredText("Model number").refine((v) => v.length <= 100, "Keep the model number under 100 characters"),
  notes: optionalText,
});

export const stockTransferSchema = z.object({
  toBranchId: requiredText("Destination branch"),
  itemId: requiredText("Item"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitCodes: optionalText,
  notes: optionalText,
});

/** Allocating one stock unit (USID) to the case the request was raised for. */
export const allocateSchema = z.object({
  unitId: requiredText("USID").refine(Boolean, "Select a USID"),
  note: optionalText,
});
