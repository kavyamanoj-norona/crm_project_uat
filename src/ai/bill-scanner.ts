import "server-only";
import { getOpenAI } from "@/lib/openai";
import type { ScannedBill } from "@/modules/inventory/billing-schema";

const MODEL = "gpt-4o-mini";

const str = { type: "string" } as const;

// Strict JSON schema: every field required, "" when the bill doesn't show it.
const SCHEMA = {
  name: "purchase_bill",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["supplierName", "supplierGstin", "supplierState", "supplierEmail", "supplierPhone", "supplierAddress", "billNo", "billDate", "roundOff", "total", "lines"],
    properties: {
      supplierName: str,
      supplierGstin: str,
      supplierState: str,
      supplierEmail: str,
      supplierPhone: str,
      supplierAddress: str,
      billNo: str,
      billDate: str,
      roundOff: str,
      total: str,
      lines: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["description", "hsnSac", "quantity", "rate", "gstPercent"],
          properties: { description: str, hsnSac: str, quantity: str, rate: str, gstPercent: str },
        },
      },
    },
  },
} as const;

const PROMPT = `You read Indian GST purchase bills / supplier invoices from a photo and return structured data.
Rules:
- Return only what is printed on the bill. Never guess; use "" for anything you cannot read.
- supplierName is the seller who issued the bill (not the buyer).
- supplierState is the seller's state as printed (e.g. "Kerala, Code : 32"); supplierEmail is the seller's e-mail, supplierPhone their contact number(s).
- billDate must be YYYY-MM-DD.
- Each line: description as printed, hsnSac if shown, quantity as a whole number, rate = price per unit BEFORE GST in rupees (plain number, no currency symbol or commas; if the bill only shows tax-inclusive prices, back-calculate the pre-tax rate), gstPercent = total GST rate for the line (CGST+SGST combined, or IGST) as a plain number such as 18.
- Do not include totals, tax summary rows, discounts or shipping as item lines.
- roundOff is the printed round-off in rupees (negative if deducted), "" if none. total is the final payable amount printed on the bill.`;

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown) => clean(v).replace(/[₹,\s]/g, "").replace(/%$/, "");

/** Reads a bill (image or PDF) with the OpenAI model. Throws if it returns nothing usable. */
export async function scanBillImage(image: { bytes: Buffer; mime: string }): Promise<{ bill: ScannedBill; tokensUsed: number }> {
  const openai = getOpenAI();
  const res = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0,
    response_format: { type: "json_schema", json_schema: SCHEMA },
    messages: [
      { role: "system", content: PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extract this purchase bill." },
          image.mime === "application/pdf"
            ? { type: "file" as const, file: { filename: "bill.pdf", file_data: `data:application/pdf;base64,${image.bytes.toString("base64")}` } }
            : { type: "image_url" as const, image_url: { url: `data:${image.mime};base64,${image.bytes.toString("base64")}`, detail: "high" as const } },
        ],
      },
    ],
  });

  const content = res.choices[0]?.message?.content;
  if (!content) throw new Error("The AI returned no data for this bill.");
  const raw = JSON.parse(content) as Record<string, unknown> & { lines?: Record<string, unknown>[] };

  const bill: ScannedBill = {
    supplierName: clean(raw.supplierName),
    supplierGstin: clean(raw.supplierGstin).toUpperCase(),
    supplierState: clean(raw.supplierState),
    supplierEmail: clean(raw.supplierEmail),
    supplierPhone: clean(raw.supplierPhone),
    supplierAddress: clean(raw.supplierAddress),
    billNo: clean(raw.billNo),
    billDate: /^\d{4}-\d{2}-\d{2}$/.test(clean(raw.billDate)) ? clean(raw.billDate) : "",
    roundOff: num(raw.roundOff),
    total: num(raw.total),
    lines: (raw.lines ?? []).map((l) => ({
      description: clean(l.description),
      hsnSac: clean(l.hsnSac),
      quantity: num(l.quantity).replace(/\.0+$/, ""),
      rate: num(l.rate),
      gstPercent: num(l.gstPercent).replace(/\.0+$/, ""),
      itemId: "",
    })),
  };
  return { bill, tokensUsed: res.usage?.total_tokens ?? 0 };
}
