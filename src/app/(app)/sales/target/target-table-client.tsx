"use client";

import { useActionState, useState, useMemo } from "react";
import { Building2, CalendarDays, Search, Trash2 } from "lucide-react";
import { SelectChip, type ChipOption } from "@/components/data/filter-chip";
import type { SalesTargetRow } from "@/server/sales/target-queries";
import type { FormState } from "@/lib/form";
import { DataTable } from "@/components/data/data-table";
import type { Column } from "@/components/data/data-table";

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

  const emptyMessage =
    targets.length === 0
      ? "No sales targets set yet. Use the form above to add one."
      : "No records match your search.";

  const columns: Column<SalesTargetRow>[] = [
    {
      header: "#",
      cell: (_r, i) => i + 1,
    },
    {
      header: "Branch",
      cell: (r) => (
        <>
          <div className="font-medium text-text">{r.branch.name}</div>
          <div className="text-xs font-mono text-text-muted">{r.branch.code}</div>
        </>
      ),
    },
    {
      header: "Period",
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            r.period === "DAILY"
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
              : r.period === "MONTHLY"
                ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
          }`}
        >
          {PERIOD_LABELS[r.period]}
        </span>
      ),
    },
    {
      header: "Date",
      cell: (r) => (
        <span className="text-text-muted">
          {targetDateLabel(r.period, r.year, r.month, r.day)}
        </span>
      ),
    },
    {
      header: "Target Amount",
      align: "right",
      cell: (r) => (
        <span className="font-semibold text-text">{fmtRupees(r.targetPaise)}</span>
      ),
    },
    {
      header: "Set By",
      cell: (r) => (
        <span className="text-text-muted text-sm">
          {r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName}` : "—"}
        </span>
      ),
    },
    ...(canDelete
      ? [
          {
            header: "",
            cell: (r: SalesTargetRow) => (
              <div className="flex justify-end">
                <DeleteButton id={r.id} deleteAction={deleteAction} />
              </div>
            ),
          } satisfies Column<SalesTargetRow>,
        ]
      : []),
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
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

        <SelectChip
          label="Branch"
          icon={Building2}
          options={[
            { value: "", label: "All Branches" },
            ...branches.map((b): ChipOption => ({ value: b.id, label: b.name })),
          ]}
          value={branchFilter}
          onChange={setBranchFilter}
        />

        <SelectChip
          label="Period"
          icon={CalendarDays}
          options={[
            { value: "", label: "All Periods" },
            { value: "DAILY", label: "Daily" },
            { value: "MONTHLY", label: "Monthly" },
            { value: "YEARLY", label: "Yearly" },
          ]}
          value={periodFilter}
          onChange={setPeriodFilter}
          searchable={false}
        />

        <span className="ml-auto text-xs text-text-muted">
          {filtered.length} record{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <DataTable
        rows={filtered}
        rowKey={(r) => r.id}
        columns={columns}
        empty={emptyMessage}
        bordered={false}
      />
    </div>
  );
}
