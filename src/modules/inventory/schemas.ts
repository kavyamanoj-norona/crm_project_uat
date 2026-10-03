import { z } from "zod";
import { optionalText, requiredText } from "@/lib/form";

export const stockAdjustSchema = z.object({
  itemId: requiredText("Item"),
  quantity: z.coerce.number().int().min(0, "Quantity must be 0 or more"),
  unitCodes: optionalText,
});

export const purchaseRequestSchema = z.object({
  itemId: requiredText("Item"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  caseId: optionalText,
  notes: optionalText,
});

export const stockTransferSchema = z.object({
  toBranchId: requiredText("Destination branch"),
  itemId: requiredText("Item"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  unitCodes: optionalText,
  notes: optionalText,
});
