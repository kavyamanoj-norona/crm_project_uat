"use client";

import { useActionState, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, type ActionResult, type FormState } from "@/lib/form";
import { formatPaise, optionalRupees, paiseToInput } from "@/lib/money";
import { discountPercent } from "@/lib/pricing";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Input } from "@/components/ui/field";
import { DataTable } from "@/components/data/data-table";
import type { CatalogItem } from "../queries";
import { ItemPicker } from "./item-picker";

type LineInfo = Pick<CatalogItem, "id" | "code" | "name" | "type" | "pricePaise" | "minPricePaise" | "maxDiscountPercent">;
type Line = { itemId: string; quantity: string; unitPrice: string; vendorCost: string };

export type LabItemsInitial = {
  lines: (Line & { info: LineInfo })[];
};

/** Lab stock and request state, keyed by item id. */
export type LabStockInfo = {
  /** Units on hand in the lab's stock. */
  stock: Record<string, number>;
  /** Items with a request still open on this case. */
  requested: string[];
  /** The saved case line behind each item (stock actions work on saved lines only). */
  caseItemIds: Record<string, string>;
};

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  catalog: CatalogItem[];
  initial: LabItemsInitial;
  /** Outsourced cases get a "Vendor ₹ / unit" column: what we pay the vendor. */
  outsource: boolean;
  stockInfo: LabStockInfo;
  requestAction: (caseItemId: string) => Promise<ActionResult>;
  consumeAction: (caseItemId: string) => Promise<ActionResult>;
};

const toPaise = (rupees: string) => {
  const r = optionalRupees("Price").safeParse(rupees);
  return r.success ? r.data : null;
};

const isPhysical = (type: string) => type === "PART" || type === "ACCESSORY";

const stockBtn = "rounded-lg px-3 py-1 text-xs font-medium disabled:opacity-60";

const initialLines = (lines: LabItemsInitial["lines"]): Line[] =>
  lines.map(({ itemId, quantity, unitPrice, vendorCost }) => ({ itemId, quantity, unitPrice, vendorCost }));

export function LabItemsSection({ action, catalog, initial, outsource, stockInfo, requestAction, consumeAction }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const [lines, setLines] = useState<Line[]>(() => initialLines(initial.lines));

  const info = new Map<string, LineInfo>([
    ...initial.lines.map((l) => [l.itemId, l.info] as const),
    ...catalog.map((c) => [c.id, c] as const),
  ]);

  const lineError = (l: Line) => {
    const i = info.get(l.itemId)!;
    const unit = toPaise(l.unitPrice);
    if (unit === null || unit <= 0) return "Enter a price";
    if (unit < i.minPricePaise) return `Lowest allowed is ${formatPaise(i.minPricePaise)} (max ${i.maxDiscountPercent}% off)`;
    if (unit > i.pricePaise) return `Can't be above ${formatPaise(i.pricePaise)}`;
    if (!/^\d+$/.test(l.quantity) || Number(l.quantity) < 1) return "Quantity must be 1 or more";
    return null;
  };

  const { errors, onSubmit, onChange } = useFormFeedback({ state });

  const set = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const total = lines.reduce((sum, l) => sum + (toPaise(l.unitPrice) ?? 0) * (Number(l.quantity) || 0), 0);
  const vendorTotal = lines.reduce((sum, l) => sum + (toPaise(l.vendorCost) ?? 0) * (Number(l.quantity) || 0), 0);

  const requested = new Set(stockInfo.requested);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      <input type="hidden" name="items" value={JSON.stringify(lines)} />

      <ItemPicker
        catalog={catalog}
        exclude={new Set(lines.map((l) => l.itemId))}
        onPick={(item) =>
          setLines((prev) => [
            ...prev,
            { itemId: item.id, quantity: "1", unitPrice: paiseToInput(item.pricePaise), vendorCost: "" },
          ])
        }
      />
      {errors.items && <p className="text-xs text-danger">{errors.items[0]}</p>}

      <DataTable
        rows={lines}
        rowKey={(l) => l.itemId}
        empty="No items yet — search above to add services and parts."
        columns={[
          {
            header: "Item",
            cell: (l) => {
              const it = info.get(l.itemId)!;
              return (
                <>
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-text-muted">
                    {it.code} · list {formatPaise(it.pricePaise)} · min {formatPaise(it.minPricePaise)}
                  </p>
                </>
              );
            },
          },
          {
            header: "Qty",
            className: "w-20",
            cell: (l) => (
              <Input
                value={l.quantity}
                onChange={(e) => set(lines.indexOf(l), { quantity: e.target.value.replace(/\D/g, "") })}
                inputMode="numeric"
                aria-label={`${info.get(l.itemId)!.name} quantity`}
                className="h-9 px-2"
              />
            ),
          },
          {
            header: "Price ₹ / unit",
            className: "w-40 align-top",
            cell: (l) => {
              const it = info.get(l.itemId)!;
              const unit = toPaise(l.unitPrice);
              const err = lineError(l);
              const off = unit !== null ? discountPercent(it.pricePaise, unit) : 0;
              return (
                <>
                  <Input
                    value={l.unitPrice}
                    onChange={(e) => set(lines.indexOf(l), { unitPrice: e.target.value })}
                    inputMode="decimal"
                    aria-label={`${it.name} price`}
                    aria-invalid={err ? true : undefined}
                    className="h-9 px-2"
                  />
                  {err ? (
                    <p className="mt-1 max-w-40 whitespace-normal text-xs text-danger">{err}</p>
                  ) : off > 0 ? (
                    <Badge tone="warning" className="mt-1">
                      {off}% discount
                    </Badge>
                  ) : null}
                </>
              );
            },
          },
          ...(outsource
            ? [
                {
                  header: "Vendor ₹ / unit",
                  className: "w-40",
                  cell: (l: Line) => (
                    <Input
                      value={l.vendorCost}
                      onChange={(e) => set(lines.indexOf(l), { vendorCost: e.target.value })}
                      inputMode="decimal"
                      placeholder="Enter vendor charge"
                      aria-label={`${info.get(l.itemId)!.name} vendor charge`}
                      className="h-9 px-2"
                    />
                  ),
                },
              ]
            : []),
          {
            header: "Total",
            align: "right" as const,
            cell: (l) => (
              <span className={cn("font-semibold tabular-nums", lineError(l) && "text-text-muted")}>
                {formatPaise((toPaise(l.unitPrice) ?? 0) * (Number(l.quantity) || 0))}
              </span>
            ),
          },
          {
            header: "Stock",
            align: "center" as const,
            cell: (l) => {
              if (!isPhysical(info.get(l.itemId)!.type)) return <span className="text-text-disabled">—</span>;
              const qty = stockInfo.stock[l.itemId] ?? 0;
              return qty === 0 ? <Badge tone="danger">No Stock</Badge> : <span className="tabular-nums">{qty}</span>;
            },
          },
          {
            header: "Action",
            cell: (l) => {
              if (!isPhysical(info.get(l.itemId)!.type)) return null;
              const caseItemId = stockInfo.caseItemIds[l.itemId];
              if (!caseItemId) return <span className="text-xs text-text-muted">Save items first</span>;
              if ((stockInfo.stock[l.itemId] ?? 0) > 0)
                return (
                  <ActionButton
                    action={consumeAction.bind(null, caseItemId)}
                    label="Use from lab stock"
                    className={cn(stockBtn, "bg-green-700 text-green-50")}
                  >
                    Consume
                  </ActionButton>
                );
              if (requested.has(l.itemId))
                return (
                  <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
                    Requested
                  </span>
                );
              return (
                <ActionButton
                  action={requestAction.bind(null, caseItemId)}
                  label="Request this item"
                  className={cn(stockBtn, "bg-red-700 text-red-50")}
                >
                  Request
                </ActionButton>
              );
            },
          },
          {
            header: "",
            className: "w-10",
            cell: (l) => (
              <Button
                variant="ghost"
                onClick={() => setLines((prev) => prev.filter((p) => p.itemId !== l.itemId))}
                aria-label={`Remove ${info.get(l.itemId)!.name}`}
                className="px-2"
              >
                <Trash2 className="size-4" />
              </Button>
            ),
          },
        ]}
      />

      {lines.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-x-8 gap-y-1 text-sm">
          {outsource && (
            <p className="text-text-muted">
              Vendor charges <span className="font-semibold tabular-nums text-text">{formatPaise(vendorTotal)}</span>
            </p>
          )}
          <p className="font-medium">
            Total <span className="ml-2 text-base font-bold tabular-nums">{formatPaise(total)}</span>
          </p>
        </div>
      )}

      {state.message && !state.ok && (
        <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{state.message}</p>
      )}
      {state.ok && (
        <p className="rounded-md bg-success/5 px-3 py-2 text-sm text-success">{state.message}</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save items
        </Button>
      </div>
    </form>
  );
}
