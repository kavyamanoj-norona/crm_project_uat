import { z } from "zod";

// USID format rules shared by the configuration form (browser) and the server.
// A USID is <prefix><number padded to a fixed width>, e.g. "HG0001": the prefix is "HG", the width is 4.

export const DEFAULT_USID_CONFIG = { prefix: "USID-", width: 5, nextNumber: 1 } as const;

const MAX_WIDTH = 12;

/** "hg0001" → { prefix: "HG", width: 4, number: 1 }. The last run of digits is the number; leading zeros set the width. */
export function parseStartingUsid(input: string): { prefix: string; width: number; number: number } | null {
  const v = input.trim().toUpperCase();
  const m = /^([A-Z0-9\-_/.]*?)(\d+)$/.exec(v);
  if (!m) return null;
  const digits = m[2]!;
  const number = Number(digits);
  if (!Number.isSafeInteger(number) || digits.length > MAX_WIDTH) return null;
  return { prefix: m[1]!, width: digits.length, number };
}

/** Pads the number to the configured width (never truncates a longer number). */
export const formatUsid = (prefix: string, width: number, n: number) => `${prefix}${String(n).padStart(width, "0")}`;

export const usidConfigSchema = z.object({
  startingUsid: z
    .string()
    .trim()
    .min(1, "Starting USID is required")
    .transform((v, ctx) => {
      const p = parseStartingUsid(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Use letters followed by digits, like HG0001" });
        return z.NEVER;
      }
      const sample = formatUsid(p.prefix, p.width, p.number);
      if (sample.length < 3 || sample.length > 40 || !/^[A-Z0-9][A-Z0-9\-_/.]{2,39}$/.test(sample)) {
        ctx.addIssue({ code: "custom", message: "A USID must be 3–40 characters: letters, digits or - _ / ." });
        return z.NEVER;
      }
      return p;
    }),
});

export const USID_CONFIG_FIELDS = ["startingUsid"] as const;

/** "0, 5, 12 18" → [0, 5, 12, 18]: whole percentages from 0 to 40, no repeats, sorted. */
export const gstRatesSchema = z.object({
  gstRates: z
    .string()
    .trim()
    .min(1, "Enter at least one GST rate")
    .transform((v, ctx) => {
      const parts = v.split(/[\s,;]+/).filter(Boolean).map((p) => p.replace(/%$/, ""));
      const nums = parts.map((p) => (/^\d{1,2}$/.test(p) ? Number(p) : NaN));
      if (nums.length === 0 || nums.some((n) => Number.isNaN(n) || n > 40)) {
        ctx.addIssue({ code: "custom", message: "Use whole percentages from 0 to 40, separated by commas, like 0, 5, 12, 18, 28" });
        return z.NEVER;
      }
      const rates = [...new Set(nums)].sort((a, b) => a - b);
      if (rates.length > 12) {
        ctx.addIssue({ code: "custom", message: "Up to 12 GST rates" });
        return z.NEVER;
      }
      return rates;
    }),
});

export const GST_CONFIG_FIELDS = ["gstRates"] as const;
