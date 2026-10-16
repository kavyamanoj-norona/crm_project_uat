"use client";

import { ConsumeUsidDialog, type UsidOption } from "@/modules/service/components/consume-usid-dialog";
import { ReorderDialog } from "@/modules/service/components/reorder-dialog";
import { VR_STATUS_LABELS } from "@/modules/inventory/vendor-replacement-labels";
import { ReturnPartDialog } from "@/modules/service/components/return-part-dialog";
import { useActionState, useState } from "react";
import { Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, type ActionResult, type FormState } from "@/lib/form";
import { formatPaise, optionalRupees, paiseToInput } from "@/lib/money";
import { discountPercent } from "@/lib/pricing";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClass } from "@/components/ui/button";
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
  /** Items already used on this case (CONSUMED) or returned unused (RETURNED_UNUSED). */
  settled: Record<string, string>;
  /** USIDs that can be consumed, per item (received at the case's branch, unused). */
  consumable: Record<string, UsidOption[]>;
  /** The USID allocated to this case, per item. */
  usids: Record<string, string>;
  /** Open vendor replacements per item: status of the replacement being arranged under the same USID. */
  vendorReplacement: Record<string, string>;
  /** Items with a received unit waiting to be used on this case. */
  received: string[];
  /** Items with a request on this case (still open, or already transferred). */
  requested: string[];
  /** Items whose latest request has been transferred: these can be reordered if the unit is defective. */
  transferred: string[];
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
  /** False until the lab's pending approval is complete: parts can't be requested before that. */
  canRequest: boolean;
  requestAction: (caseItemId: string) => Promise<ActionResult>;
  /** Reorder an item whose transferred unit is defective (asks for a reason). */
  reorderAction: (caseItemId: string, prev: FormState, formData: FormData) => Promise<FormState>;
  /** Return a received part to Head Office (reason + remarks). */
  returnAction: (caseItemId: string, prev: FormState, formData: FormData) => Promise<FormState>;
  consumeAction: (caseItemId: string, prev: FormState, formData: FormData) => Promise<FormState>;
  jobsheetNo: string;
};

const toPaise = (rupees: string) => {
  const r = optionalRupees("Price").safeParse(rupees);
  return r.success ? r.data : null;
};

const isPhysical = (type: string) => type === "PART" || type === "ACCESSORY";

const initialLines = (lines: LabItemsInitial["lines"]): Line[] =>
  lines.map(({ itemId, quantity, unitPrice, vendorCost }) => ({ itemId, quantity, unitPrice, vendorCost }));

export function LabItemsSection({ action, catalog, initial, outsource, stockInfo, canRequest, requestAction, reorderAction, returnAction, consumeAction, jobsheetNo }: Props) {
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
  const transferred = new Set(stockInfo.transferred);

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
                  <p className="flex items-center gap-2 font-medium">
                    {it.name}
                    {stockInfo.usids[l.itemId] && <Badge tone="navy" className="tabular-nums">{stockInfo.usids[l.itemId]}</Badge>}
                  </p>
                  <p className="text-xs text-text-muted">
                    {it.code} · list {formatPaise(it.pricePaise)} · min {formatPaise(it.minPricePaise)}
                  </p>
                </>
              );
            },
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
            header: "Action",
            align: "center" as const,
            cell: (l) => {
              if (!isPhysical(info.get(l.itemId)!.type)) return null;
              const caseItemId = stockInfo.caseItemIds[l.itemId];
              if (!caseItemId) return <span className="text-xs text-text-muted">Save items first</span>;
              const done = stockInfo.settled[l.itemId];
              if (done) return <Badge tone={done === "CONSUMED" ? "success" : "neutral"}>{done === "CONSUMED" ? "Consumed" : "Returned"}</Badge>;
              const received = stockInfo.received.includes(l.itemId);
              const options = stockInfo.consumable[l.itemId] ?? [];
              if (options.length > 0 || (stockInfo.stock[l.itemId] ?? 0) > 0) {
                // Consuming starts only after the customer has approved the estimate.
                if (!canRequest) return <span className="text-xs text-text-muted">After approval</span>;
                return (
                  <span className="inline-flex items-center gap-2">
                    <ConsumeUsidDialog
                      itemName={info.get(l.itemId)!.name}
                      jobsheetNo={jobsheetNo}
                      options={options}
                      allowStock={(stockInfo.stock[l.itemId] ?? 0) > 0}
                      action={consumeAction.bind(null, caseItemId)}
                    />
                    {received && <ReturnPartDialog itemName={info.get(l.itemId)!.name} action={returnAction.bind(null, caseItemId)} />}
                  </span>
                );
              }
              if (requested.has(l.itemId)) {
                const sent = transferred.has(l.itemId);
                return (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-flex items-center rounded-lg border border-border bg-surface-muted px-3 py-1 text-xs font-medium text-text-muted">
                      {sent ? "Transferred" : "Requested"}
                    </span>
                    {sent && canRequest && <ReorderDialog itemName={info.get(l.itemId)!.name} action={reorderAction.bind(null, caseItemId)} />}
                  </span>
                );
              }
              const vendor = stockInfo.vendorReplacement[l.itemId];
              if (vendor) return <Badge tone="violet">Vendor replacement · {VR_STATUS_LABELS[vendor as keyof typeof VR_STATUS_LABELS]}</Badge>;
              if (!canRequest) return <span className="text-xs text-text-muted">After approval</span>;
              return (
                <ActionButton
                  action={requestAction.bind(null, caseItemId)}
                  label="Request this item"
                  className={buttonClass("danger", "sm")}
                >
                  <ShoppingCart className="size-3.5" /> Request
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
