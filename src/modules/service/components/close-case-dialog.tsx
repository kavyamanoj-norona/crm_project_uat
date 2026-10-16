"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { SearchSelect } from "@/components/forms/search-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatPaise } from "@/lib/money";
import type { FormState } from "@/lib/form";
import { parseRupees } from "@/modules/inventory/billing-schema";
import { CLOSING_PAYMENT_LABELS, CLOSING_PAYMENT_MODES, billSummary, type ClosingPayload } from "../case-billing-math";

export type ClosingLineView = { key: string; code: string; name: string; type: string; quantity: number; unitPricePaise: number; gstPercent: number };
export type ClosingAccessoryView = { id: string; code: string; name: string; pricePaise: number; minPricePaise: number; gstPercent: number; stock: number };

type Props = {
  jobsheetNo: string;
  customerName: string;
  gstInclusive: boolean;
  lines: ClosingLineView[];
  advancePaise: number;
  accessories: ClosingAccessoryView[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

type AddedRow = { itemId: string; quantity: string; price: string };
type PayRow = { mode: (typeof CLOSING_PAYMENT_MODES)[number]; amount: string; reference: string };

const rupees = (paise: number) => String(Number((paise / 100).toFixed(2)));
const TYPE_LABEL: Record<string, string> = { SERVICE: "Service", PART: "Spare part", ACCESSORY: "Accessory" };

function Body({ jobsheetNo, customerName, gstInclusive, lines, advancePaise, accessories, errors }: Omit<Props, "action"> & { errors: Record<string, string[] | undefined> }) {
  const [added, setAdded] = useState<AddedRow[]>([]);
  const [pays, setPays] = useState<PayRow[]>([]);
  const [notes, setNotes] = useState("");
  const [acceptDue, setAcceptDue] = useState(false);

  const catalog = useMemo(() => new Map(accessories.map((a) => [a.id, a])), [accessories]);

  // Everything on the bill, with GST split per line (the same maths as the server).
  const all = [
    ...lines.map((l) => ({ key: l.key, name: l.name, code: l.code, type: l.type, quantity: l.quantity, unitPricePaise: l.unitPricePaise, gstPercent: l.gstPercent })),
    ...added.map((a, i) => {
      const item = catalog.get(a.itemId)!;
      return { key: `add-${i}`, name: item.name, code: item.code, type: "ACCESSORY", quantity: Number(a.quantity) || 0, unitPricePaise: parseRupees(a.price) ?? 0, gstPercent: item.gstPercent };
    }),
  ];
  const sum = billSummary(all, gstInclusive);
  const advanceApplied = Math.min(advancePaise, sum.totalPaise);
  const dueNow = sum.totalPaise - advanceApplied;
  const collected = pays.reduce((s, p) => s + (parseRupees(p.amount) ?? 0), 0);
  const remaining = dueNow - collected;

  const payload: ClosingPayload = {
    accessories: added.map((a) => ({ itemId: a.itemId, quantity: Number(a.quantity) || 0, unitPricePaise: parseRupees(a.price) ?? 0 })),
    payments: pays.filter((p) => (parseRupees(p.amount) ?? 0) > 0).map((p) => ({ mode: p.mode, amountPaise: parseRupees(p.amount) ?? 0, reference: p.reference.trim() })),
    notes: notes.trim(),
    acceptDue,
  };

  const addable = accessories.filter((a) => !added.some((r) => r.itemId === a.id));
  const setAdd = (i: number, patch: Partial<AddedRow>) => setAdded((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setPay = (i: number, patch: Partial<PayRow>) => setPays((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const half = (n: number) => Math.floor(n / 2);

  return (
    <div className="space-y-5">
      <input type="hidden" name="payload" value={JSON.stringify(payload)} />
      <p className="text-sm text-text-muted">
        {jobsheetNo} · {customerName}. Services and the spare parts consumed on this case are billed. Parts returned unused are not.
      </p>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs font-semibold">
            <tr>
              <th className="px-3 py-2 text-left">Item</th>
              <th className="px-3 py-2 text-center">Qty</th>
              <th className="px-3 py-2 text-right">Price ₹</th>
              <th className="px-3 py-2 text-center">GST</th>
              <th className="px-3 py-2 text-right">Amount ₹</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {all.map((l, i) => {
              const isAdded = l.key.startsWith("add-");
              const idx = i - lines.length;
              const row = isAdded ? added[idx]! : null;
              return (
                <tr key={l.key}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-text-muted">
                      {l.code} · {TYPE_LABEL[l.type] ?? l.type}
                      {isAdded && " · added to bill"}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">
                    {row ? (
                      <Input className="mx-auto h-8 w-16 text-center" inputMode="numeric" aria-label={`${l.name} quantity`} value={row.quantity} onChange={(e) => setAdd(idx, { quantity: e.target.value.replace(/\D/g, "") })} />
                    ) : (
                      l.quantity
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {row ? (
                      <Input className="ml-auto h-8 w-24 text-right" inputMode="decimal" aria-label={`${l.name} price`} value={row.price} onChange={(e) => setAdd(idx, { price: e.target.value })} />
                    ) : (
                      formatPaise(l.unitPricePaise, { symbol: false })
                    )}
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums">{l.gstPercent}%</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{formatPaise(sum.amounts[i]!.lineTotalPaise, { symbol: false })}</td>
                  <td className="px-1 py-2 text-center">
                    {isAdded && (
                      <button type="button" aria-label={`Remove ${l.name}`} onClick={() => setAdded((p) => p.filter((_, j) => j !== idx))} className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-danger">
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {all.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-text-muted">
                  Nothing to bill yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Add an accessory or product (optional)" htmlFor="close-accessory" hint="For example a cleaning kit. Only items in this branch's stock are listed.">
            <SearchSelect
              id="close-accessory"
              value=""
              onChange={(id) => {
                const a = catalog.get(id);
                if (a) setAdded((p) => [...p, { itemId: id, quantity: "1", price: rupees(a.pricePaise) }]);
              }}
              options={addable.map((a) => ({ value: a.id, label: `${a.code} — ${a.name} · ₹${rupees(a.pricePaise)} · ${a.stock} in stock` }))}
              placeholder={addable.length ? "Search accessories" : "No accessories in stock"}
            />
            {errors.accessories?.[0] && <p className="mt-1 text-xs text-danger">{errors.accessories[0]}</p>}
          </Field>

          <Field label="Notes" htmlFor="close-notes" hint="Optional, printed on the invoice.">
            <Textarea id="close-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Enter notes" />
          </Field>
        </div>

        <dl className="space-y-1.5 rounded-lg bg-surface-muted px-4 py-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-muted">{gstInclusive ? "Taxable value" : "Subtotal"}</dt>
            <dd className="tabular-nums">{formatPaise(sum.taxablePaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">CGST</dt>
            <dd className="tabular-nums">{formatPaise(half(sum.taxPaise))}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">SGST</dt>
            <dd className="tabular-nums">{formatPaise(sum.taxPaise - half(sum.taxPaise))}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-1.5 font-bold">
            <dt>Bill total</dt>
            <dd className="tabular-nums">{formatPaise(sum.totalPaise)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-muted">Advance received</dt>
            <dd className="tabular-nums">− {formatPaise(advanceApplied)}</dd>
          </div>
          <div className="flex justify-between rounded-md bg-primary-soft px-2 py-1.5 text-base font-bold text-brand-navy dark:text-text">
            <dt>Payable now</dt>
            <dd className="tabular-nums">{formatPaise(dueNow)}</dd>
          </div>
        </dl>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12.5px] font-bold text-brand-navy dark:text-text">Payment</p>
          <div className="flex gap-2">
            {dueNow > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setPays([{ mode: "CASH", amount: rupees(dueNow), reference: "" }])}>
                Full amount in cash
              </Button>
            )}
            {pays.length < 6 && (
              <Button variant="secondary" size="sm" onClick={() => setPays((p) => [...p, { mode: "CASH", amount: remaining > 0 ? rupees(remaining) : "", reference: "" }])}>
                <Plus className="size-3.5" /> Add payment
              </Button>
            )}
          </div>
        </div>
        {pays.length === 0 && <p className="text-sm text-text-muted">No payment taken now. The whole payable amount stays as an outstanding due.</p>}
        {pays.map((p, i) => (
          <div key={i} className="grid items-center gap-2 sm:grid-cols-[9rem_9rem_1fr_auto]">
            <Select aria-label={`Payment ${i + 1} mode`} value={p.mode} onChange={(e) => setPay(i, { mode: e.target.value as PayRow["mode"] })} options={CLOSING_PAYMENT_MODES.map((m) => ({ value: m, label: CLOSING_PAYMENT_LABELS[m] }))} placeholder="Select mode" />
            <Input aria-label={`Payment ${i + 1} amount`} inputMode="decimal" value={p.amount} onChange={(e) => setPay(i, { amount: e.target.value })} placeholder="Enter amount" />
            <Input aria-label={`Payment ${i + 1} reference`} value={p.reference} onChange={(e) => setPay(i, { reference: e.target.value })} placeholder="Enter reference (optional)" />
            <button type="button" aria-label={`Remove payment ${i + 1}`} onClick={() => setPays((x) => x.filter((_, j) => j !== i))} className="justify-self-end rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-danger">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        {errors.payments?.[0] && <p className="text-xs text-danger">{errors.payments[0]}</p>}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-text-muted">Paid now</span>
          <Badge tone="success" className="tabular-nums">{formatPaise(collected)}</Badge>
          {remaining > 0 ? <Badge tone="warning" className="tabular-nums">Outstanding due {formatPaise(remaining)}</Badge> : remaining < 0 ? <Badge tone="danger">More than payable by {formatPaise(-remaining)}</Badge> : <Badge tone="success">Fully paid</Badge>}
        </div>
        {remaining > 0 && (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
            <input type="checkbox" checked={acceptDue} onChange={(e) => setAcceptDue(e.target.checked)} className="mt-0.5 size-4 accent-primary" />
            <span>Close the case with {formatPaise(remaining)} still due. It stays in Customer Dues until collected.</span>
          </label>
        )}
        {errors.due?.[0] && <p className="text-xs text-danger">{errors.due[0]}</p>}
      </div>
    </div>
  );
}

/** "Move to Closed": review the bill, add accessories, take payments, then generate the invoice and close the case. */
export function CloseCaseDialog(props: Props) {
  const { action, ...rest } = props;
  return (
    <ActionDialog
      trigger={
        <>
          Move to Closed <ArrowRight className="size-4" />
        </>
      }
      triggerVariant="navy"
      size="xl"
      title={`Close ${props.jobsheetNo} — final bill`}
      action={action}
      validate={(fd) => {
        try {
          const p = JSON.parse(String(fd.get("payload") ?? "{}")) as ClosingPayload;
          const bad = p.payments.find((x) => x.amountPaise <= 0);
          if (bad) return { payments: ["Each payment needs an amount"] };
        } catch {
          return null;
        }
        return null;
      }}
      submitLabel="Generate invoice & close case"
    >
      {(errors) => <Body {...rest} errors={errors} />}
    </ActionDialog>
  );
}
