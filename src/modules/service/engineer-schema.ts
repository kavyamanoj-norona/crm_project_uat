import { z } from "zod";

const text = (label: string) =>
  z
    .string()
    .trim()
    .min(3, `Enter the ${label}`)
    .max(2000, `Keep the ${label} under 2000 characters`);

/** What the engineer records for a case in Diagnosis. */
export const diagnosisSchema = z.object({
  details: text("diagnosis details"),
  findings: text("findings"),
  recommendedRepairs: text("recommended repairs"),
});

export const DIAGNOSIS_FIELDS = ["details", "findings", "recommendedRepairs"] as const;
