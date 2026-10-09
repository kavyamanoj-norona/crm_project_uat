"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { formatPaise, optionalRupees, paiseToInput } from "@/lib/money";
import { discountPercent } from "@/lib/pricing";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ModalButton } from "@/components/ui/modal-button";
import { labItemsSchema } from "../case-schema";
import type { CatalogItem } from "../queries";
import { ItemPicker } from "./item-picker";

type LineInfo = Pick<CatalogItem, "id" | "code" | "name" | "pricePaise" | "minPricePaise" | "maxDiscountPercent">;
type Line = { itemId: string; quantity: string; unitPrice: string };

export type LabItemsInitial = {
  lines: (Line & { info: LineInfo })[];
};

type LabItemsDialogProps = {
  trigger: React.ReactNode;
  jobsheetNo: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  catalog: CatalogItem[];
  initial: LabItemsInitial;
};

const toPaise = (rupees: string) => {
  const r = optionalRupees("Price").safeParse(rupees);
  return r.success ? r.data : null;
};

export function LabItemsDialog({ trigger, jobsheetNo, ...form }: LabItemsDialogProps) {
  return (
    <ModalButton
      trigger={trigger}
      variant="secondary"
      size="xl"
      title={`Lab items — ${jobsheetNo}`}
      description="Add or update billable items for this chip-level case. Existing branch items are shown — you may keep, remove, or add more."
    >
      {(close) => <LabItemsForm {...form} onDone={close} />}
    </ModalButton>
  );
}

function LabItemsForm({
  action,
  catalog,
  initial,
  onDone,
}: Omit<LabItemsDialogProps, "trigger" | "jobsheetNo"> & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [lines, setLines] = useState<Line[]>(initial.lines.map(({ itemId, quantity, unitPrice }) => ({ itemId, quantity, unitPrice })));
  const info = new Map<string, LineInfo>([...initial.lines.map((l) => [l.itemId, l.info] as const), ...catalog.map((c) => [c.id, c] as const)]);

  const lineError = (l: Line) => {
    const i = info.get(l.itemId)!;
    const unit = toPaise(l.unitPrice);
    if (unit === null || unit <= 0) return "Enter a price";
    if (unit < i.minPricePaise) return `Lowest allowed is ${formatPaise(i.minPricePaise)} (max ${i.maxDiscountPercent}% off)`;
    if (unit > i.pricePaise) return `Can't be above ${formatPaise(i.pricePaise)}`;
    if (!/^\d+$/.test(l.quantity) || Number(l.quantity) < 1) return "Quantity must be 1 or more";
    return null;
  };

  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => {
      const e = validateForm(labItemsSchema, fd) ?? {};
      const bad = lines.map(lineError).find(Boolean);
      if (bad) e.items = [bad];
      return Object.keys(e).length ? e : null;
    },
  });

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  const set = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((sum, l) => sum + (toPaise(l.unitPrice) ?? 0) * (Number(l.quantity) || 0), 0);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-5">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      <div>
        <p className="mb-1.5 text-sm font-medium">Billable items</p>
        <ItemPicker
          catalog={catalog}
          exclude={new Set(lines.map((l) => l.itemId))}
          onPick={(item) => setLines((prev) => [...prev, { itemId: item.id, quantity: "1", unitPrice: paiseToInput(item.pricePaise) }])}
        />
        {errors.items && <p className="mt-1 text-xs text-danger">{errors.items[0]}</p>}

        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="border-b border-border text-left text-[11px] font-bold uppercase tracking-[1px] text-text-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="w-20 px-3 py-2 font-semibold">Qty</th>
                <th className="w-40 px-3 py-2 font-semibold">Price ₹ / unit</th>
                <th className="w-28 px-3 py-2 text-right font-semibold">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-muted">
                    No items yet — search above to add services and parts.
                  </td>
                </tr>
              )}
              {lines.map((l, i) => {
                const it = info.get(l.itemId)!;
                const unit = toPaise(l.unitPrice);
                const err = lineError(l);
                const off = unit !== null ? discountPercent(it.pricePaise, unit) : 0;
                return (
                  <tr key={l.itemId} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{it.name}</p>
                      <p className="text-xs text-text-muted">
                        {it.code} · list {formatPaise(it.pricePaise)} · min {formatPaise(it.minPricePaise)}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={l.quantity}
                        onChange={(e) => set(i, { quantity: e.target.value.replace(/\D/g, "") })}
                        inputMode="numeric"
                        aria-label={`${it.name} quantity`}
                        className="h-9 px-2"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={l.unitPrice}
                        onChange={(e) => set(i, { unitPrice: e.target.value })}
                        inputMode="decimal"
                        aria-label={`${it.name} price`}
                        aria-invalid={err ? true : undefined}
                        className="h-9 px-2"
                      />
                      {err ? (
                        <p className="mt-1 text-xs text-danger">{err}</p>
                      ) : off > 0 ? (
                        <Badge tone="warning" className="mt-1">
                          {off}% discount
                        </Badge>
                      ) : null}
                    </td>
                    <td className={cn("px-3 py-2 pt-4 text-right font-semibold tabular-nums", err && "text-text-muted")}>
                      {formatPaise((unit ?? 0) * (Number(l.quantity) || 0))}
                    </td>
                    <td className="px-1 py-2">
                      <Button
                        variant="ghost"
                        onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                        aria-label={`Remove ${it.name}`}
                        className="px-2"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {lines.length > 0 && (
              <tfoot>
                <tr className="border-t border-border bg-surface-muted">
                  <td colSpan={3} className="px-3 py-2.5 text-right font-medium">
                    Total
                  </td>
                  <td className="px-3 py-2.5 text-right text-base font-bold tabular-nums">{formatPaise(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Close
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save items
        </Button>
      </div>
    </form>
  );
}
