"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, ToggleLeft, X } from "lucide-react";
import { SelectChip } from "@/components/data/filter-chip";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { DataTable } from "@/components/data/data-table";
import { tatUnitOptions } from "@/modules/service/tat-schema";

export type TatConfigEntry = {
  targetValue: number;
  targetUnit: string;
  warningThreshold: number;
  escalationThreshold: number;
  isActive: boolean;
  remarks: string | null;
};

export type TatRow = {
  status: string;
  stageName: string;
  stageTone: string;
  config: TatConfigEntry | null;
};

type Props = {
  rows: TatRow[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  canEdit: boolean;
};

const UNIT_LABELS: Record<string, string> = { MINUTES: "min", HOURS: "h", DAYS: "d" };
const ACTIVE_OPTIONS = [
  { value: "yes", label: "Yes — active" },
  { value: "no", label: "No — skip this stage" },
];

// ── Inline edit form ──────────────────────────────────────────────────────────

function EditForm({ row, action, onDone }: { row: TatRow; action: Props["action"]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state });

  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);

  const cfg = row.config;
  const v = state.values;
  const dv = (field: keyof TatConfigEntry, fallback: string) =>
    v?.[field] ?? (cfg ? String(cfg[field] ?? "") : fallback);

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/[0.03] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-brand-navy dark:text-text">Editing TAT:</span>
          <Badge tone={row.stageTone as Parameters<typeof Badge>[0]["tone"]}>{row.stageName}</Badge>
        </div>
        <Button variant="ghost" onClick={onDone} className="h-7 w-7 p-0">
          <X className="size-4" />
        </Button>
      </div>

      <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate>
        <input type="hidden" name="status" value={row.status} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Target value" htmlFor={`tv-${row.status}`} required error={errors.targetValue}>
            <Input id={`tv-${row.status}`} name="targetValue" type="number" min={1} max={9999}
              defaultValue={dv("targetValue", "4")} aria-invalid={errors.targetValue ? true : undefined} />
          </Field>
          <Field label="Unit" htmlFor={`tu-${row.status}`} required error={errors.targetUnit}>
            <Select id={`tu-${row.status}`} name="targetUnit" defaultValue={dv("targetUnit", "HOURS")}
              options={tatUnitOptions} placeholder="" />
          </Field>
          <Field label="Active?" htmlFor={`ia-${row.status}`} error={errors.isActive}>
            <Select id={`ia-${row.status}`} name="isActive"
              defaultValue={v?.isActive ?? (cfg === null || cfg.isActive ? "yes" : "no")}
              options={ACTIVE_OPTIONS} placeholder="" />
          </Field>
          <Field label="Warning threshold" htmlFor={`wt-${row.status}`} required error={errors.warningThreshold}
            hint="% of TAT at which to show warning">
            <Input id={`wt-${row.status}`} name="warningThreshold" type="number" min={1} max={99}
              defaultValue={dv("warningThreshold", "80")} aria-invalid={errors.warningThreshold ? true : undefined} />
          </Field>
          <Field label="Escalation threshold" htmlFor={`et-${row.status}`} required error={errors.escalationThreshold}
            hint="% at which the stage is overdue">
            <Input id={`et-${row.status}`} name="escalationThreshold" type="number" min={1} max={999}
              defaultValue={dv("escalationThreshold", "100")} aria-invalid={errors.escalationThreshold ? true : undefined} />
          </Field>
          <Field label="Remarks" htmlFor={`rm-${row.status}`} error={errors.remarks}>
            <Input id={`rm-${row.status}`} name="remarks" maxLength={500}
              defaultValue={dv("remarks", "")} placeholder="Enter remarks" />
          </Field>
        </div>

        {state.message && !state.ok && <p className="mt-3 text-sm text-danger">{state.message}</p>}

        <div className="mt-4 flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
          <Button variant="secondary" onClick={onDone} type="button">Cancel</Button>
        </div>
      </form>
    </div>
  );
}

// ── Panel (inline form + DataTable) ──────────────────────────────────────────

export function TatConfigPanel({ rows, action, canEdit }: Props) {
  const [editing, setEditing] = useState<TatRow | null>(null);
  const [activeFilter, setActiveFilter] = useState("");

  const visibleRows = activeFilter === "active"
    ? rows.filter((r) => r.config?.isActive === true)
    : activeFilter === "inactive"
      ? rows.filter((r) => !r.config?.isActive)
      : rows;

  return (
    <div>
      {editing && <EditForm row={editing} action={action} onDone={() => setEditing(null)} />}

      <div className="mb-4 flex items-center gap-2">
        <SelectChip
          label="Status"
          icon={ToggleLeft}
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          value={activeFilter}
          onChange={setActiveFilter}
          searchable={false}
        />
        <span className="ml-auto text-xs text-text-muted">
          {visibleRows.length} stage{visibleRows.length !== 1 ? "s" : ""}
        </span>
      </div>

      <DataTable
        rows={visibleRows}
        rowKey={(r) => r.status}
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Stage",
            cell: (r) => (
              <Badge tone={r.stageTone as Parameters<typeof Badge>[0]["tone"]}>{r.stageName}</Badge>
            ),
          },
          {
            header: "Target TAT",
            cell: (r) =>
              r.config ? (
                <span className="font-semibold tabular-nums">
                  {r.config.targetValue}{" "}
                  <span className="font-normal text-text-muted">
                    {UNIT_LABELS[r.config.targetUnit] ?? r.config.targetUnit}
                  </span>
                </span>
              ) : (
                <span className="italic text-text-muted">Not configured</span>
              ),
          },
          {
            header: "Warning at",
            align: "center",
            cell: (r) =>
              r.config ? (
                <span className="tabular-nums">{r.config.warningThreshold}%</span>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          {
            header: "Overdue at",
            align: "center",
            cell: (r) =>
              r.config ? (
                <span className="tabular-nums">{r.config.escalationThreshold}%</span>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          {
            header: "Active",
            align: "center",
            cell: (r) =>
              r.config ? (
                <Badge tone={r.config.isActive ? "success" : "neutral"}>
                  {r.config.isActive ? "Yes" : "No"}
                </Badge>
              ) : (
                <span className="text-text-muted">—</span>
              ),
          },
          {
            header: "Remarks",
            cell: (r) =>
              r.config?.remarks ? (
                <span className="text-sm text-text-muted">{r.config.remarks}</span>
              ) : (
                <span className="text-text-disabled">—</span>
              ),
          },
          ...(canEdit
            ? [
                {
                  header: "Action",
                  align: "right" as const,
                  cell: (r: TatRow) => (
                    <Button
                      variant={editing?.status === r.status ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => setEditing(editing?.status === r.status ? null : r)}
                    >
                      <Pencil className="size-3.5" />
                      {editing?.status === r.status ? "Editing…" : "Edit"}
                    </Button>
                  ),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}
