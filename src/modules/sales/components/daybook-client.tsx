"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Lock, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Date picker ──────────────────────────────────────────────────────────────

export function DaybookDatePicker({ currentDate, path }: { currentDate: string; path: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  return (
    <input
      type="date"
      value={currentDate}
      max={new Date().toISOString().slice(0, 10)}
      onChange={(e) =>
        start(() => router.push(`${path}?date=${e.target.value}`))
      }
      className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-primary"
    />
  );
}

// ─── Day status badge ─────────────────────────────────────────────────────────

export function DayStatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold",
        status === "open"
          ? "border-success/30 bg-success/10 text-success"
          : "border-border bg-surface-muted text-text-muted",
      )}
    >
      {status === "open" ? "● Day open" : "✓ Day closed"}
    </span>
  );
}

// ─── Expense categories ───────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Utilities",
  "Stationery",
  "Travel",
  "Food & Beverages",
  "Maintenance",
  "Courier",
  "Rent",
  "Marketing",
  "Other",
] as const;

// ─── Add expense form + EOD reconcile ────────────────────────────────────────

type DaybookFormPanelProps = {
  /** Current CRM cash balance in paise. */
  crmBalancePaise: number;
};

export function DaybookFormPanel({ crmBalancePaise }: DaybookFormPanelProps) {
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState<string>("Utilities");
  const [amount, setAmount] = useState("");
  const [hasReceipt, setHasReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [physical, setPhysical] = useState("");
  const [verified, setVerified] = useState(false);
  const [closing, setClosing] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const physicalNum = parseFloat(physical) || 0;
  const variancePaise = physicalNum * 100 - crmBalancePaise;
  const crmRupees = (crmBalancePaise / 100).toLocaleString("en-IN");

  const handlePostExpense = async () => {
    if (!desc.trim() || amountNum <= 0) return;
    setSubmitting(true);
    // TODO: wire to server action when finance integration is ready
    await new Promise((r) => setTimeout(r, 800));
    setDesc("");
    setAmount("");
    setHasReceipt(false);
    setSubmitting(false);
  };

  const handleVerify = () => {
    if (!physical.trim()) return;
    setVerified(true);
  };

  const handleCloseDay = async () => {
    if (!verified) return;
    setClosing(true);
    // TODO: wire to server action
    await new Promise((r) => setTimeout(r, 1000));
    setClosing(false);
  };

  return (
    <div className="space-y-4">
      {/* ── Add expense ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-text">Add expense (cash out)</h3>
        <div className="space-y-3">
          {/* Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">
              Description <span className="text-danger">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Water bill, stationery..."
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
            />
          </div>

          {/* Category + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Category <span className="text-danger">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-text-muted">
                Amount ₹ <span className="text-danger">*</span>
              </label>
              <input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="1"
                step="1"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
              />
            </div>
          </div>

          {/* Receipt upload */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-text-muted">Receipt</label>
            {hasReceipt ? (
              <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5">
                <CheckCircle2 className="size-4 text-success" />
                <span className="text-xs font-medium text-success">Receipt attached</span>
                <button
                  type="button"
                  onClick={() => setHasReceipt(false)}
                  className="ml-auto text-xs text-text-muted hover:text-text"
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setHasReceipt(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm text-text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <Paperclip className="size-4" />
                Attach receipt photo
              </button>
            )}
          </div>

          {/* Submit */}
          <button
            type="button"
            disabled={!desc.trim() || amountNum <= 0 || submitting}
            onClick={() => void handlePostExpense()}
            className="w-full rounded-lg bg-brand-navy py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-primary"
          >
            {submitting ? "Posting…" : "Post to cash book"}
          </button>
          <p className="text-center text-xs text-text-muted">
            Posts instantly as{" "}
            <span className="font-medium text-danger">money out</span> in the
            ledger and updates the live balance.
          </p>
        </div>
      </div>

      {/* ── EOD Reconcile ────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text">
            End of day — reconcile & close
          </h3>
          <span className="shrink-0 rounded-full bg-warning/15 px-2.5 py-0.5 text-[11px] font-semibold text-warning">
            mandatory
          </span>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-text-muted">
          Count the physical cash in the box, enter it below, and verify against
          the CRM balance. Sales or Branch Manager must close the day;
          tomorrow&apos;s opening balance carries from this close.
        </p>

        {/* CRM balance row */}
        <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-muted px-4 py-3">
          <span className="text-xs font-medium text-text-muted">CRM cash balance</span>
          <span className="text-sm font-bold text-text">₹{crmRupees}</span>
        </div>

        {/* Physical count input */}
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-medium text-text-muted">
            Physical cash counted
          </label>
          <input
            type="number"
            placeholder="Enter counted amount"
            value={physical}
            min="0"
            onChange={(e) => {
              setPhysical(e.target.value);
              setVerified(false);
            }}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-primary"
          />
          {physical && variancePaise !== 0 && (
            <p
              className={cn(
                "mt-1.5 text-xs font-medium",
                variancePaise < 0 ? "text-danger" : "text-success",
              )}
            >
              Variance:{" "}
              {variancePaise < 0 ? "−" : "+"}₹
              {Math.abs(variancePaise / 100).toLocaleString("en-IN")} — a reason
              is required
            </p>
          )}
          {physical && variancePaise === 0 && (
            <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" />
              Cash count matches CRM balance
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!physical.trim() || verified}
            onClick={handleVerify}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text transition-colors hover:border-primary hover:text-primary disabled:opacity-40"
          >
            {verified ? "✓ Verified" : "Verify count"}
          </button>
          <button
            type="button"
            disabled={!verified || closing}
            onClick={() => void handleCloseDay()}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-navy py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-primary"
          >
            <Lock className="size-3.5" />
            {closing ? "Closing…" : "Reconcile & close day"}
          </button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">
          A variance requires a reason and is escalated to Admin — it appears in
          the Closing Cash Report and the audit log.
        </p>
      </div>
    </div>
  );
}
