// Invoice maths shared by the closing dialog (browser) and the server. Integer paise only; GST is split per line.

export type BillLineInput = { unitPricePaise: number; quantity: number; gstPercent: number };
export type BillLineAmounts = { taxablePaise: number; taxPaise: number; lineTotalPaise: number };

/**
 * GST inclusive (the default): the price already contains GST, so taxable = price ÷ (1 + rate) and tax is the rest.
 * GST exclusive: GST is added on top of the price.
 */
export function billLine(l: BillLineInput, gstInclusive: boolean): BillLineAmounts {
  const gross = l.unitPricePaise * l.quantity;
  if (gstInclusive) {
    const taxable = Math.round((gross * 100) / (100 + l.gstPercent));
    return { taxablePaise: taxable, taxPaise: gross - taxable, lineTotalPaise: gross };
  }
  const tax = Math.round((gross * l.gstPercent) / 100);
  return { taxablePaise: gross, taxPaise: tax, lineTotalPaise: gross + tax };
}

export function billSummary(lines: BillLineInput[], gstInclusive: boolean) {
  const amounts = lines.map((l) => billLine(l, gstInclusive));
  return {
    amounts,
    taxablePaise: amounts.reduce((s, a) => s + a.taxablePaise, 0),
    taxPaise: amounts.reduce((s, a) => s + a.taxPaise, 0),
    totalPaise: amounts.reduce((s, a) => s + a.lineTotalPaise, 0),
  };
}

export const CLOSING_PAYMENT_MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"] as const;
export const CLOSING_PAYMENT_LABELS: Record<(typeof CLOSING_PAYMENT_MODES)[number], string> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
};

/** The payload the closing dialog posts: accessories added to the bill and the payments collected now. */
export type ClosingPayload = {
  /** `unitIds` are the USIDs picked from received stock; any quantity beyond them comes from stock without a USID. */
  accessories: { itemId: string; quantity: number; unitPricePaise: number; unitIds: string[] }[];
  payments: { mode: (typeof CLOSING_PAYMENT_MODES)[number]; amountPaise: number; reference: string }[];
  notes: string;
  /** The user confirmed closing with part of the bill still unpaid. */
  acceptDue: boolean;
};
