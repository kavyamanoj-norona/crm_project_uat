"use client";

import { useActionState, useState } from "react";
import type { BuybackRow } from "@/server/sales/queries";
import type { FormState } from "@/lib/form";

type Props = {
  rows: BuybackRow[];
  recordAction: (prev: FormState, data: FormData) => Promise<FormState>;
};

const statusLabel: Record<string, { label: string; cls: string }> = {
  PENDING_ASSESSMENT: { label: "Pending", cls: "bg-yellow-100 text-yellow-800" },
  SENT_FOR_REFURBISHMENT: { label: "Sent for Refurb", cls: "bg-blue-100 text-blue-800" },
  ADDED_TO_REFURB_STOCK: { label: "In Refurb Stock", cls: "bg-indigo-100 text-indigo-800" },
  SOLD: { label: "Sold", cls: "bg-green-100 text-green-800" },
  SCRAPPED: { label: "Scrapped", cls: "bg-gray-100 text-gray-600" },
};

function fmt(paise: number) {
  return (paise / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}

export function BuybackPanel({ rows, recordAction }: Props) {
  const [formOpen, setFormOpen] = useState(false);
  const [state, formAction, pending] = useActionState<FormState, FormData>(recordAction, {});

  // User enters agreed price in rupees; hidden input carries paise for the action
  const [agreedPricePaise, setAgreedPricePaise] = useState(0);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-semibold text-text">Buyback</h2>
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
        >
          + Record Buyback
        </button>
      </div>

      {formOpen && (
        <form action={formAction} className="space-y-3 border-b border-border bg-surface-raised p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Record Buyback
          </p>

          {state.message && (
            <p
              className={`rounded px-2 py-1 text-xs ${
                state.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              {state.message}
            </p>
          )}

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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Device Name
              </label>
              <input
                name="deviceName"
                required
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="e.g. Dell Latitude 7490"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Brand</label>
              <input
                name="brand"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="e.g. Dell"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Model</label>
              <input
                name="deviceModel"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
                Condition
              </label>
              <select
                name="condition"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              >
                <option value="WORKING">Working</option>
                <option value="PARTIAL">Partial</option>
                <option value="NOT_WORKING">Not Working</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-text-muted">
              Agreed Price (₹)
            </label>
            {/* User enters rupees; hidden input carries paise for the action */}
            <input
              type="number"
              required
              min={1}
              placeholder="Amount in rupees"
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              onChange={(e) => setAgreedPricePaise(Math.round(Number(e.target.value) * 100))}
            />
            <input type="hidden" name="agreedPricePaise" value={agreedPricePaise} />
          </div>

          <div>
            <label className="mb-0.5 block text-[11px] font-medium text-text-muted">Notes</label>
            <textarea
              name="notes"
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
              placeholder="Any remarks"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-raised"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {pending ? "Saving…" : "Record Buyback"}
            </button>
          </div>
        </form>
      )}

      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-text-muted">No buyback records yet.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((row) => {
            const s = statusLabel[row.status] ?? { label: row.status, cls: "bg-gray-100 text-gray-600" };
            return (
              <div key={row.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text">{row.deviceName}</p>
                    <p className="text-xs text-text-muted">
                      {row.customerName} · {row.customerPhone}
                    </p>
                    {row.brand && (
                      <p className="text-xs text-text-muted">{row.brand}</p>
                    )}
                    <p className="mt-1 text-xs font-semibold text-text">
                      {fmt(row.agreedPricePaise)} bought
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${s.cls}`}
                  >
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
