import { z } from "zod";

// Money is stored as integer paise (blueprint §11). These helpers convert at
// the edges only: form input → paise, paise → display.

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

/** 750000 → "₹7,500"; null → "—". */
export function formatPaise(paise: number | null | undefined, { symbol = true } = {}) {
  if (paise === null || paise === undefined) return "—";
  const text = inr.format(paise / 100);
  return symbol ? `₹${text}` : text;
}

/** 750000 → "7500" for an <input>. */
export function paiseToInput(paise: number | null | undefined) {
  return paise === null || paise === undefined ? "" : String(paise / 100);
}

/**
 * Optional rupee amount typed by a person ("7,500" or "7500.50") → paise, or
 * null when empty. Never goes through floats for the stored value.
 */
export const optionalRupees = (label: string, maxRupees = 10_00_000) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[,\s₹]/g, ""))
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), `${label}: enter an amount like 7500 or 7500.50`)
    .transform((v) => {
      if (v === "") return null;
      const [whole, frac = ""] = v.split(".");
      return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
    })
    .refine((p) => p === null || p <= maxRupees * 100, `${label} can't be more than ${formatPaise(maxRupees * 100)}`);
