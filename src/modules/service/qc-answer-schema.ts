import { z } from "zod";

/** Stages that run the QC checklist: branch QC and the lab's own QC. */
export const QC_STAGES = ["QUALITY_CHECK", "CHIP_LAB_QUALITY_CHECK"] as const;
export type QcStage = (typeof QC_STAGES)[number];

export const qcAnswerSchema = z
  .object({
    itemId: z.string().min(1),
    passed: z.enum(["yes", "no"], { error: "Select Yes or No" }),
    remarks: z.string().trim().max(500, "Keep remarks under 500 characters"),
  })
  .superRefine((v, ctx) => {
    if (v.passed === "no" && v.remarks === "")
      ctx.addIssue({ code: "custom", path: ["remarks"], message: "Remarks are required when the answer is No" });
  });
export type QcAnswer = z.input<typeof qcAnswerSchema>;

/** The answers travel as one JSON field, like the estimate lines. */
export const qcAnswersSchema = z.object({
  answers: z
    .string()
    .transform((v, ctx) => {
      try {
        return JSON.parse(v) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Answers could not be read" });
        return z.NEVER;
      }
    })
    .pipe(z.array(qcAnswerSchema).min(1, "Answer every checklist item"))
    .refine((rows) => new Set(rows.map((r) => r.itemId)).size === rows.length, "Each item can be answered once"),
});

/** First problem in one answer, or null when it is complete. */
export function qcAnswerError(answer: QcAnswer): string | null {
  const r = qcAnswerSchema.safeParse(answer);
  return r.success ? null : r.error.issues[0]!.message;
}
