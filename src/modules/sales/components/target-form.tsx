"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { SALES_PATHS } from "../paths";
import { TARGET_FIELDS, targetSchema } from "../target-schema";

export type TargetFormValues = Record<string, string>;
type Branch = { id: string; code: string; name: string };

type TargetFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  branches: Branch[];
  initial?: TargetFormValues;
  id?: string;
};

const PERIODS = [
  { value: "DAILY", label: "Daily" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
].map((label, i) => ({ value: String(i + 1), label }));

const thisYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(thisYear + 1 - i)).map((y) => ({ value: y, label: y }));

export function TargetForm({ action, branches, initial, id }: TargetFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(targetSchema, fd, TARGET_FIELDS),
  });
  const v: TargetFormValues = state.values ?? initial ?? {};

  const [period, setPeriod] = useState(v.period ?? "");
  const [month, setMonth] = useState(v.month ?? "");
  const [year, setYear] = useState(v.year ?? "");
  const [selected, setSelected] = useState<string[]>(v.branchIds ? v.branchIds.split(",") : []);

  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));
  const toggle = (branchId: string) =>
    setSelected((s) => (s.includes(branchId) ? s.filter((x) => x !== branchId) : [...s, branchId]));

  const f = (name: string) => ({
    id: name,
    name,
    "aria-invalid": errors[name] ? true : undefined,
  });

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} className="space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <input type="hidden" name="branchIds" value={selected.join(",")} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Branch" htmlFor="branch-list" required error={errors.branchIds} className="sm:col-span-2 lg:col-span-3">
          {id ? (
            <Input
              id="branch-list"
              value={branches.find((b) => b.id === selected[0])?.name ?? ""}
              readOnly
              disabled
            />
          ) : (
            <div
              id="branch-list"
              className="max-h-40 overflow-y-auto rounded-lg border border-border bg-surface p-2 aria-invalid:border-danger"
              aria-invalid={errors.branchIds ? true : undefined}
            >
              <div className="mb-1 flex items-center justify-between px-1 text-xs">
                <button
                  type="button"
                  className="font-medium text-primary hover:underline"
                  onClick={() => setSelected(selected.length === branches.length ? [] : branches.map((b) => b.id))}
                >
                  {selected.length === branches.length ? "Clear all" : "Select all"}
                </button>
                <span className="text-text-muted">{selected.length} selected</span>
              </div>
              <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2 lg:grid-cols-3">
                {branches.map((b) => (
                  <label key={b.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1.5 text-sm hover:bg-surface-muted">
                    <input
                      type="checkbox"
                      checked={selected.includes(b.id)}
                      onChange={() => toggle(b.id)}
                      className="accent-primary"
                    />
                    <span className="truncate">{b.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </Field>
        <Field label="Period" htmlFor="period" required error={errors.period}>
          <Select {...f("period")} value={period} onChange={(e) => setPeriod(e.target.value)} options={PERIODS} placeholder="Select period" />
        </Field>
        <Field label="Year" htmlFor="year" required error={errors.year}>
          <Select {...f("year")} value={year} onChange={(e) => setYear(e.target.value)} options={YEARS} placeholder="Select year" />
        </Field>
        {(period === "MONTHLY" || period === "DAILY") && (
          <Field label="Month" htmlFor="month" required error={errors.month}>
            <Select {...f("month")} value={month} onChange={(e) => setMonth(e.target.value)} options={MONTHS} placeholder="Select month" />
          </Field>
        )}
        {period === "DAILY" && (
          <Field label="Day" htmlFor="day" required error={errors.day}>
            <Select {...f("day")} defaultValue={v.day ?? ""} options={days} placeholder="Select day" />
          </Field>
        )}
        <Field label="Target amount (₹)" htmlFor="targetRupees" required error={errors.targetRupees}>
          <Input {...f("targetRupees")} type="number" min="1" step="1" inputMode="numeric" defaultValue={v.targetRupees ?? ""} placeholder="Enter target amount" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={SALES_PATHS.target} variant="secondary">
            Cancel
          </LinkButton>
        ) : (
          <Button
            type="reset"
            variant="danger"
            onClick={() => {
              setSelected([]);
              setPeriod("");
              setMonth("");
              setYear("");
            }}
          >
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
