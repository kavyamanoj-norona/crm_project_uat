import { z } from "zod";
import { optionalText, requiredText } from "@/lib/form";

export const qcChecklistSchema = z.object({
  title: requiredText("Checklist item").pipe(
    z.string().min(2, "Title is too short").max(150),
  ),
  description: optionalText.refine(
    (v) => v === null || v.length <= 500,
    "Keep the description under 500 characters",
  ),
});

export type QcChecklistInput = z.output<typeof qcChecklistSchema>;

export const QC_CHECKLIST_FIELDS = Object.keys(qcChecklistSchema.shape);
