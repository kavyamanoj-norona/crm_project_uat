"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { parseRupees } from "@/modules/inventory/billing-schema";

type Option = { value: string; label: string };
type Row = { accountId: string; branchId: string; debit: string; credit: string };

function Body({ accounts, branches, today, errors }: { accounts: Option[]; branches: Option[]; today: string; errors: Record<string, string[] | undefined> }) {
  const [rows, setRows] = useState<Row[]>([
    { accountId: "", branchId: branches[0]?.value ?? "", debit: "", credit: "" },
    { accountId: "", branchId: branches[0]?.value ?? "", debit: "", credit: "" },
  ]);
  const set = (i: number, patch: Partial<Row>) => setRows((p) => p.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const debit = rows.reduce((s, r) => s + (parseRupees(r.debit) ?? 0), 0);
  const credit = rows.reduce((s, r) => s + (parseRupees(r.credit) ?? 0), 0);

  return (
    <div className="space-y-4">
      <input type="hidden" name="lines" value={JSON.stringify(rows)} />
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Field label="Date" htmlFor="mj-date" required error={errors.date}>
          <Input id="mj-date" type="date" name="date" defaultValue={today} max={today} />
        </Field>
        <Field label="Narration" htmlFor="mj-narration" required error={errors.narration}>
          <Textarea id="mj-narration" name="narration" rows={1} placeholder="Enter narration" />
        </Field>
      </div>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="grid items-center gap-2 md:grid-cols-[1fr_9rem_8rem_8rem_auto]">
            <Select aria-label={`Line ${i + 1} account`} value={r.accountId} onChange={(e) => set(i, { accountId: e.target.value })} options={accounts} placeholder="Select account" />
            <Select aria-label={`Line ${i + 1} branch`} value={r.branchId} onChange={(e) => set(i, { branchId: e.target.value })} options={branches} placeholder="Select branch" />
            <Input aria-label={`Line ${i + 1} debit`} inputMode="decimal" value={r.debit} onChange={(e) => set(i, { debit: e.target.value, credit: e.target.value ? "" : r.credit })} placeholder="Enter debit" />
            <Input aria-label={`Line ${i + 1} credit`} inputMode="decimal" value={r.credit} onChange={(e) => set(i, { credit: e.target.value, debit: e.target.value ? "" : r.debit })} placeholder="Enter credit" />
            <button type="button" aria-label={`Remove line ${i + 1}`} disabled={rows.length <= 2} onClick={() => setRows((p) => p.filter((_, j) => j !== i))} className="justify-self-end rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-danger disabled:opacity-40">
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" onClick={() => setRows((p) => [...p, { accountId: "", branchId: branches[0]?.value ?? "", debit: "", credit: "" }])}>
          <Plus className="size-3.5" /> Add line
        </Button>
        {errors.lines?.[0] && <p className="text-xs text-danger">{errors.lines[0]}</p>}
      </div>
      <p className={`rounded-lg px-3 py-2 text-sm ${debit === credit && debit > 0 ? "bg-success/10 text-success" : "bg-surface-muted text-text-muted"}`}>
        Debit {formatPaise(debit)} · Credit {formatPaise(credit)} {debit === credit && debit > 0 ? "· balanced" : debit !== credit ? `· difference ${formatPaise(Math.abs(debit - credit))}` : ""}
      </p>
    </div>
  );
}

/** A manual journal entry: the debits and credits must balance in total and within each branch. */
export function ManualJournalDialog({ accounts, branches, today, action }: { accounts: Option[]; branches: Option[]; today: string; action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog trigger="New journal entry" triggerVariant="primary" size="xl" title="Manual journal entry" description="Adjustments and opening balances. Entries cannot be edited later: a mistake is corrected with a reversal." action={action} submitLabel="Post entry">
      {(errors) => <Body accounts={accounts} branches={branches} today={today} errors={errors} />}
    </ActionDialog>
  );
}
