import { z } from "zod";

// Shares are stored as integer basis points (6000 = 60%), never floats — the
// same rule as money in paise. These helpers convert at the edges only.

/** Percentage typed by a person ("60", "12.5", "60%") → basis points, or null when empty. */
export const optionalPercent = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[%\s]/g, ""))
    .refine((v) => v === "" || /^\d{1,3}(\.\d{1,2})?$/.test(v), `${label}: enter a percentage like 60 or 12.5`)
    .transform((v) => {
      if (v === "") return null;
      const [whole, frac = ""] = v.split(".");
      return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    })
    .refine((bp) => bp === null || bp <= 10000, `${label} can't be more than 100%`);

/** 6000 → "60"; 1250 → "12.5" (for an <input>). */
export const bpToInput = (bp: number | null | undefined) =>
  bp === null || bp === undefined ? "" : String(bp / 100);

/** 6000 → "60%"; 1250 → "12.5%". */
export const formatPercent = (bp: number) => `${bp / 100}%`;
