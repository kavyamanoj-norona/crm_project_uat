"use client";

import { useActionState, useRef, useState, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";
import { createSalesTargets } from "@/server/sales/target-actions";
import type { FormState } from "@/lib/form";

type Branch = { id: string; code: string; name: string; isVirtual: boolean };
type Period = "DAILY" | "MONTHLY" | "YEARLY";

const PERIODS: { value: Period; label: string }[] = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const MONTHS = [
  { v: 1, l: "January" }, { v: 2, l: "February" }, { v: 3, l: "March" },
  { v: 4, l: "April" }, { v: 5, l: "May" }, { v: 6, l: "June" },
  { v: 7, l: "July" }, { v: 8, l: "August" }, { v: 9, l: "September" },
  { v: 10, l: "October" }, { v: 11, l: "November" }, { v: 12, l: "December" },
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() + 1 - i);

// ─── Multi-select branch dropdown ────────────────────────────────────────────

function BranchMultiSelect({
  branches,
  selected,
  onChange,
  error,
}: {
  branches: Branch[];
  selected: Set<string>;
  onChange: (ids: Set<string>) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  function toggle(id: string) {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  const label =
    selected.size === 0
      ? "Select Branch"
      : selected.size === branches.length
        ? "All Branches"
        : branches
            .filter((b) => selected.has(b.id))
            .map((b) => b.name)
            .join(", ");

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-sm text-left bg-surface focus:outline-none focus:ring-1 focus:ring-primary transition-colors ${
          error ? "border-danger" : "border-border hover:border-primary/50"
        }`}
      >
        <span className={`truncate ${selected.size === 0 ? "text-text-muted" : "text-text"}`}>
          {label}
        </span>
        <ChevronDown className={`size-4 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={() => onChange(new Set(branches.map((b) => b.id)))}
            >
              Select All
            </button>
            <button
              type="button"
              className="text-xs text-text-muted hover:text-text"
              onClick={() => onChange(new Set())}
            >
              Clear
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {branches.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-text hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  checked={selected.has(b.id)}
                  onChange={() => toggle(b.id)}
                  className="accent-primary"
                />
                <span>{b.name}</span>
                {b.isVirtual && <span className="text-xs text-text-muted">(virtual)</span>}
              </label>
            ))}
          </div>
          {selected.size > 0 && (
            <div className="border-t border-border px-3 py-2 text-xs text-text-muted">
              {selected.size} selected
            </div>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function CreateTargetForm({ branches }: { branches: Branch[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createSalesTargets, {});

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [period, setPeriod] = useState<Period>("MONTHLY");
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(1);
  const [targetRupees, setTargetRupees] = useState("");

  const daysInMonth = new Date(year, month, 0).getDate();
  const branchIdsStr = [...selectedIds].join(",");

  function reset() {
    setSelectedIds(new Set());
    setPeriod("MONTHLY");
    setYear(new Date().getFullYear());
    setMonth(new Date().getMonth() + 1);
    setDay(1);
    setTargetRupees("");
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
      {state.message && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2.5 text-sm ${
            state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
          }`}
        >
          <span className="flex-1">{state.message}</span>
          <X className="size-4 shrink-0 mt-0.5 opacity-70" />
        </div>
      )}

      <form action={action}>
        {/* Hidden inputs */}
        <input type="hidden" name="branchIds" value={branchIdsStr} />
        <input type="hidden" name="period" value={period} />
        <input type="hidden" name="year" value={year} />
        {(period === "MONTHLY" || period === "DAILY") && (
          <input type="hidden" name="month" value={month} />
        )}
        {period === "DAILY" && <input type="hidden" name="day" value={day} />}
        <input type="hidden" name="targetRupees" value={targetRupees} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branch */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-text">
              Branch <span className="text-danger">*</span>
            </label>
            <BranchMultiSelect
              branches={branches}
              selected={selectedIds}
              onChange={setSelectedIds}
              error={[state.fieldErrors?.branchIds].flat()[0]}
            />
          </div>

          {/* Period */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Period <span className="text-danger">*</span>
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {state.fieldErrors?.period && (
              <p className="mt-1 text-xs text-danger">{state.fieldErrors.period}</p>
            )}
          </div>

          {/* Year */}
          <div>
            <label className="mb-1 block text-sm font-medium text-text">
              Year <span className="text-danger">*</span>
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          {/* Month — MONTHLY + DAILY */}
          {(period === "MONTHLY" || period === "DAILY") && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Month <span className="text-danger">*</span>
              </label>
              <select
                value={month}
                onChange={(e) => { setMonth(Number(e.target.value)); setDay(1); }}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MONTHS.map((m) => (
                  <option key={m.v} value={m.v}>{m.l}</option>
                ))}
              </select>
              {state.fieldErrors?.month && (
                <p className="mt-1 text-xs text-danger">{state.fieldErrors.month}</p>
              )}
            </div>
          )}

          {/* Day — DAILY only */}
          {period === "DAILY" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text">
                Day <span className="text-danger">*</span>
              </label>
              <select
                value={day}
                onChange={(e) => setDay(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {/* Target amount */}
          <div className="lg:col-span-2">
            <label className="mb-1 block text-sm font-medium text-text">
              Target Amount (₹) <span className="text-danger">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 500000"
              value={targetRupees}
              onChange={(e) => setTargetRupees(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {state.fieldErrors?.targetRupees && (
              <p className="mt-1 text-xs text-danger">{state.fieldErrors.targetRupees}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending || selectedIds.size === 0}
            className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {pending ? "Saving…" : "Create"}
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg border border-border bg-surface px-6 py-2.5 text-sm font-medium text-text hover:bg-surface-muted"
          >
            Reset
          </button>
        </div>
      </form>
    </div>
  );
}
