"use client";

import { useActionState, useState } from "react";
import type { AccessoryStockRow } from "@/server/sales/queries";
import type { FormState } from "@/lib/form";

type Props = {
  rows: AccessoryStockRow[];
  sellAction: (prev: FormState, data: FormData) => Promise<FormState>;
};

function fmt(paise: number) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function AccessoriesPanel({ rows, sellAction }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold text-text">Accessories</h2>
        <p className="text-sm text-text-muted">No accessories in stock.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-semibold text-text">Accessories</h2>
      </div>
      <div className="divide-y divide-border">
        {rows.map((row) => (
          <AccessoryRow key={row.id} row={row} sellAction={sellAction} />
        ))}
      </div>
    </div>
  );
}

function AccessoryRow({
  row,
  sellAction,
}: {
  row: AccessoryStockRow;
  sellAction: Props["sellAction"];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(sellAction, {});

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-text">{row.item.name}</p>
          <p className="text-xs text-text-muted">
            {fmt(row.item.pricePaise)} · {row.quantity} in stock
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
        >
          Sell
        </button>
      </div>

      {open && (
        <form action={formAction} className="mt-3 space-y-2 rounded-lg bg-surface-raised p-3">
          {state.message && !state.ok && (
            <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">{state.message}</p>
          )}
          {state.ok && (
            <p className="rounded bg-green-50 px-2 py-1 text-xs text-green-700">{state.message}</p>
          )}

          <input type="hidden" name="stockItemId" value={row.id} />
          <input type="hidden" name="itemId" value={row.item.id} />
          <input type="hidden" name="itemName" value={row.item.name} />
          <input type="hidden" name="unitPricePaise" value={row.item.pricePaise} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Customer Name
              </label>
              <input
                name="customerName"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                placeholder="Enter name"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Phone</label>
              <input
                name="customerPhone"
                type="tel"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text placeholder:text-text-muted focus:border-primary focus:outline-none"
                placeholder="Enter phone number"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Qty</label>
              <input
                name="quantity"
                type="number"
                required
                min={1}
                max={row.quantity}
                defaultValue={1}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Payment</label>
              <select
                name="paymentMode"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            Unit price:{" "}
            <span className="font-semibold text-text">{fmt(row.item.pricePaise)}</span>
          </p>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Record Sale"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
