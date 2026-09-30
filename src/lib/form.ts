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

/** Result of a one-click action (toggle, lock …), shown as a toast. */
export type ActionResult = { ok: boolean; message: string };

/** Trimmed text; empty → null. */
export const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const requiredText = (label: string) => z.string().trim().min(1, `${label} is required`);

/** Checkbox value: "on" when checked, missing otherwise. */
export const checkbox = z
  .union([z.literal("on"), z.literal("true"), z.literal(""), z.null(), z.undefined()])
  .transform((v) => v === "on" || v === "true");

/** Reads the named text fields from FormData; missing fields read as "" so they get the normal "… is required" message. */
export function pick(formData: FormData, keys: readonly string[]) {
  return Object.fromEntries(keys.map((k) => [k, formData.get(k) ?? ""]));
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

/**
 * Validates submitted FormData against a schema (same one the server uses).
 * Returns field errors, or null when valid. Safe in the browser.
 */
export function validateForm(schema: z.ZodType, formData: FormData, keys?: readonly string[]) {
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape;
  const names = keys ?? (shape ? Object.keys(shape) : [...formData.keys()]);
  const result = schema.safeParse(pick(formData, names));
  if (result.success) return null;
  return z.flattenError(result.error).fieldErrors as Record<string, string[] | undefined>;
}
