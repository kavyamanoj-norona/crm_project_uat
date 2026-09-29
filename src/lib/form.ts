import { z } from "zod";

/** State returned by every form server action. */
export type FormState = {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Submitted values, echoed back so a failed submit keeps what was typed. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

/** Trimmed text; empty → null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);

/** Checkbox value: "on" when checked, missing otherwise. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

/** Reads the named fields from FormData (missing → null). */
export function pick(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k)]));
}

/** Text values of a submitted form, minus passwords and files. */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) {
    if (typeof v === "string" && !k.toLowerCase().includes("password") && !k.startsWith("$")) out[k] = v;
  }
  return out;
}

export function toFieldErrors(error: z.ZodError, formData?: FormData): FormState {
  return {
    message: "Please fix the highlighted fields.",
    fieldErrors: z.flattenError(error).fieldErrors,
    values: formData ? formValues(formData) : undefined,
  };
}
