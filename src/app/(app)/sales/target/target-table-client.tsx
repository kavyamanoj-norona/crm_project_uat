"use client";

import { useActionState, useState, useMemo } from "react";
import { Search, Trash2 } from "lucide-react";
import type { SalesTargetRow } from "@/server/sales/target-queries";
import type { FormState } from "@/lib/form";

type Branch = { id: string; code: string; name: string; isVirtual: boolean };
type DeleteAction = (_prev: FormState, formData: FormData) => Promise<FormState>;

const MONTH_NAMES = [
  "", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function targetDateLabel(period: string, year: number, month?: number | null, day?: number | null) {
  if (period === "DAILY" && month && day) return `${day} ${MONTH_NAMES[month]} ${year}`;
  if (period === "MONTHLY" && month) return `${MONTH_NAMES[month]} ${year}`;
  return String(year);
}

function fmtRupees(paise: number) {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(2)} Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(2)} L`;
  return `₹${r.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

const PERIOD_LABELS: Record<string, string> = {
  DAILY: "Daily",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

function DeleteButton({ id, deleteAction }: { id: string; deleteAction: DeleteAction }) {
  const [, action, pending] = useActionState<FormState, FormData>(deleteAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        title="Remove target"
        className="rounded p-1.5 text-text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </form>
  );
}

export function TargetTableClient({
  targets,
  branches,
  canDelete,
  deleteAction,
}: {
  targets: SalesTargetRow[];
  branches: Branch[];
  canDelete: boolean;
  deleteAction: DeleteAction;
  searchParams?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return targets.filter((t) => {
      if (periodFilter && t.period !== periodFilter) return false;
      if (branchFilter && t.branchId !== branchFilter) return false;
      if (q) {
        const haystack = [
          t.branch.name,
          t.branch.code,
          PERIOD_LABELS[t.period],
          targetDateLabel(t.period, t.year, t.month, t.day),
          fmtRupees(t.targetPaise),
          t.createdBy ? `${t.createdBy.firstName} ${t.createdBy.lastName}` : "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [targets, search, periodFilter, branchFilter]);

  return (
    <div className="rounded-xl border border-border bg-surface shadow-sm">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search targets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <select
          value={branchFilter}
          onChange={(e) => setBranchFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>

        <select
          value={periodFilter}
          onChange={(e) => setPeriodFilter(e.target.value)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">All Periods</option>
          <option value="DAILY">Daily</option>
          <option value="MONTHLY">Monthly</option>
          <option value="YEARLY">Yearly</option>
        </select>

        <span className="ml-auto text-xs text-text-muted">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-text-muted">
          {targets.length === 0
            ? "No sales targets set yet. Use the form above to add one."
            : "No records match your search."}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-semibold text-text-muted uppercase tracking-wide">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Target Amount</th>
                <th className="px-4 py-3">Set By</th>
                {canDelete && <th className="px-4 py-3 w-12" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((t, i) => (
                <tr key={t.id} className="hover:bg-surface-muted/40 transition-colors">
                  <td className="px-4 py-3 text-text-muted text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-text">{t.branch.name}</div>
                    <div className="text-xs font-mono text-text-muted">{t.branch.code}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      t.period === "DAILY"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : t.period === "MONTHLY"
                          ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                    }`}>
                      {PERIOD_LABELS[t.period]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {targetDateLabel(t.period, t.year, t.month, t.day)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-text">
                    {fmtRupees(t.targetPaise)}
                  </td>
                  <td className="px-4 py-3 text-text-muted text-sm">
                    {t.createdBy
                      ? `${t.createdBy.firstName} ${t.createdBy.lastName}`
                      : "—"}
                  </td>
                  {canDelete && (
                    <td className="px-4 py-3 text-right">
                      <DeleteButton id={t.id} deleteAction={deleteAction} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
