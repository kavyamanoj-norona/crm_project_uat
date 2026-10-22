"use client";

import { formatPaise, optionalRupees } from "@/lib/money";
import { Input } from "@/components/ui/field";
import { setDraft, useDrafts } from "./billing-draft";

type BilledAmountCellProps = {
  caseId: string;
  itemId: string;
  /** Saved billed price per unit, in rupees as typed. */
  value: string;
  minPricePaise: number;
};

/** Parses a typed rupee amount to paise; null when it isn't a positive amount. */
export function billedPaise(text: string) {
  const r = optionalRupees("Billed amount").safeParse(text);
  return r.success && r.data !== null && r.data > 0 ? r.data : null;
}

/** Why a typed billed amount can't be saved, or null. Only the minimum selling price applies: there is no maximum. */
export function billedError(text: string, minPricePaise: number) {
  const paise = billedPaise(text);
  if (paise === null) return "Enter a billed amount";
  return paise < minPricePaise ? `Lowest allowed is ${formatPaise(minPricePaise)}` : null;
}

/** The Billed ₹ cell of the billing table: type a new price (not below the minimum); it is saved with Save changes. */
export function BilledAmountCell({ caseId, itemId, value, minPricePaise }: BilledAmountCellProps) {
  const text = useDrafts(caseId)[itemId] ?? value;
  const dirty = text.trim() !== value.trim();
  const error = dirty ? billedError(text, minPricePaise) : null;

  return (
    <span className="ml-auto flex w-36 flex-col items-end">
      <Input
        value={text}
        onChange={(e) => setDraft(caseId, itemId, e.target.value.trim() === value.trim() ? null : e.target.value)}
        inputMode="decimal"
        placeholder="Enter billed amount"
        aria-label="Billed amount"
        aria-invalid={error ? true : undefined}
        className="h-8 px-2 text-right font-semibold"
      />
      {error && <span className="mt-1 text-right text-xs text-danger">{error}</span>}
    </span>
  );
}
