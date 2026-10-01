import { z } from "zod";

// Phone numbers are stored as digits only, so they can be the customer dedupe
// key: mobiles as 10 digits (9847012345), landlines with STD code (04842401234).

const MOBILE = /^[6-9]\d{9}$/;
const LANDLINE = /^0\d{9,10}$/;

/** "+91 98470-12345" → "9847012345". Leaves anything it can't recognise as digits. */
export function normalizePhone(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0") && MOBILE.test(d.slice(1))) d = d.slice(1);
  return d;
}

export const isValidPhone = (digits: string) => MOBILE.test(digits) || LANDLINE.test(digits);

/** "9847012345" → "98470 12345"; landlines are shown as stored. */
export function formatPhone(digits: string | null | undefined) {
  if (!digits) return "—";
  return MOBILE.test(digits) ? `${digits.slice(0, 5)} ${digits.slice(5)}` : digits;
}

const PHONE_MESSAGE = "Enter a 10-digit mobile or a landline with STD code";

export const requiredPhone = (label = "Phone") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform(normalizePhone)
    .refine(isValidPhone, PHONE_MESSAGE);

export const optionalPhone = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : normalizePhone(v)))
  .refine((v) => v === null || isValidPhone(v), PHONE_MESSAGE);
