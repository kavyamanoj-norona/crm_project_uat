"use client";

import { useActionState, useState } from "react";
import type { RefurbRow } from "@/server/sales/queries";
import type { FormState } from "@/lib/form";

type Props = {
  rows: RefurbRow[];
  sellAction: (prev: FormState, data: FormData) => Promise<FormState>;
  addAction: (prev: FormState, data: FormData) => Promise<FormState>;
};

const gradeBadge: Record<string, string> = {
  A: "bg-green-100 text-green-800",
  B: "bg-yellow-100 text-yellow-800",
  C: "bg-orange-100 text-orange-800",
};

function fmt(paise: number) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function RefurbPanel({ rows, sellAction, addAction }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [addState, addFormAction, addPending] = useActionState<FormState, FormData>(addAction, {});

  // Paise state for the add form — user types rupees, hidden inputs carry paise
  const [costPaise, setCostPaise] = useState(0);
  const [sellPaise, setSellPaise] = useState(0);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-text">Refurbished in stock</h2>
        <button
          type="button"
          onClick={() => setAddOpen((o) => !o)}
          className="rounded-lg border border-border px-2.5 py-1 text-xs font-medium text-text-muted hover:bg-surface-raised"
        >
          + Add Device
        </button>
      </div>

      {addOpen && (
        <form action={addFormAction} className="space-y-3 border-b border-border bg-surface-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Add Refurbished Device
          </p>

          {addState.message && (
            <p
              className={`rounded px-2 py-1 text-xs ${
                addState.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {addState.message}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Device Name
              </label>
              <input
                name="name"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="Enter model"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Brand</label>
              <input
                name="brand"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="Enter brand"
              />
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Specs</label>
            <input
              name="specs"
              required
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              placeholder="Enter specifications"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Grade</label>
              <select
                name="grade"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Cost (₹)
              </label>
              {/* User enters rupees; hidden input carries paise for the action */}
              <input
                type="number"
                min={1}
                required
                placeholder="Enter amount"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                onChange={(e) => setCostPaise(Math.round(Number(e.target.value) * 100))}
              />
              <input type="hidden" name="costPaise" value={costPaise} />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Sell Price (₹)
              </label>
              <input
                type="number"
                min={1}
                required
                placeholder="Enter amount"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                onChange={(e) => setSellPaise(Math.round(Number(e.target.value) * 100))}
              />
              <input type="hidden" name="sellingPricePaise" value={sellPaise} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Warranty (months)
              </label>
              <input
                name="warrantyMonths"
                type="number"
                min={0}
                defaultValue={36}
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Serial No.
              </label>
              <input
                name="serialNo"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="Enter remarks"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={addPending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {addPending ? "Saving…" : "Add to Stock"}
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-muted">No refurbished devices available.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => (
            <RefurbRow key={row.id} row={row} sellAction={sellAction} />
          ))}
        </div>
      )}
    </div>
  );
}

function RefurbRow({
  row,
  sellAction,
}: {
  row: RefurbRow;
  sellAction: Props["sellAction"];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(sellAction, {});
  const margin = row.sellingPricePaise - row.costPaise;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-text">{row.name}</p>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                gradeBadge[row.grade] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              Grade {row.grade}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{row.specs}</p>
          <div className="mt-1 flex gap-3 text-xs">
            <span className="font-semibold text-text">{fmt(row.sellingPricePaise)}</span>
            <span className="text-text-muted">Cost {fmt(row.costPaise)}</span>
            <span className="text-green-600">+{fmt(margin)}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-text-muted">{row.warrantyMonths}m warranty</p>
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
          {state.message && (
            <p
              className={`rounded px-2 py-1 text-xs ${
                state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {state.message}
            </p>
          )}

          <input type="hidden" name="refurbItemId" value={row.id} />
          <input type="hidden" name="salePricePaise" value={row.sellingPricePaise} />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Customer Name
              </label>
              <input
                name="customerName"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Phone</label>
              <input
                name="customerPhone"
                type="tel"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
              Payment Mode
            </label>
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

          <p className="text-xs text-text-muted">
            Sale price:{" "}
            <span className="font-semibold text-text">{fmt(row.sellingPricePaise)}</span>
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
              {pending ? "Selling…" : "Confirm Sale"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
