import { z } from "zod";

/** "REPEAT_CUSTOMER" → "Repeat customer". */
export const enumLabel = (v: string) => v.charAt(0) + v.slice(1).toLowerCase().replace(/_/g, " ");

/** Select options for an enum, with optional label overrides. */
export const enumOptions = (values: readonly string[], labels: Partial<Record<string, string>> = {}) =>
  values.map((v) => ({ value: v, label: labels[v] ?? enumLabel(v) }));

/** Select value that may be left empty → null. */
export const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.enum(values).nullable());

/** Select value that must be picked. */
export const requiredEnum = <T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, { error: `Select ${label.toLowerCase()}` });
