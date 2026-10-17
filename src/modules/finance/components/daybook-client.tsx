"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Landmark, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, type FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PhotoInput } from "@/components/forms/photo-input";
import { parseRupees } from "@/modules/inventory/billing-schema";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;
type Option = { value: string; label: string };

// ─── Open one branch from the all-branches summary ───────────────────────────

/** Switches the header branch to this row's branch, which opens its cash book. */
export function OpenBranchButton({ action, label }: { action: () => Promise<void>; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => action())}
      aria-label={`Open ${label} cash book`}
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-60"
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <ArrowRight className="size-3.5" />}
      Open
    </button>
  );
}

// ─── Day status badge ─────────────────────────────────────────────────────────

export function DayStatusBadge({ status }: { status: "open" | "closed" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-semibold",
        status === "open" ? "border-success/30 bg-success/10 text-success" : "border-border bg-surface-muted text-text-muted",
      )}
    >
      {status === "open" ? "● Day open" : "✓ Day closed"}
    </span>
  );
}

function Panel({ title, badge, children }: { title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text">{title}</h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

/** A form that resets itself (fields and receipt) after every successful post. */
function useResettingForm(action: Action) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state });
  const [round, setRound] = useState(0);
  const last = useRef(state);
  useEffect(() => {
    if (state !== last.current && state.ok) setRound((r) => r + 1);
    last.current = state;
  }, [state]);
  return { formAction, pending, errors, onSubmit, onChange, round };
}

// ─── Add expense (cash out) ───────────────────────────────────────────────────

export function ExpenseCard({ action, categories }: { action: Action; categories: Option[] }) {
  const f = useResettingForm(action);
  return (
    <Panel title="Add expense (cash out)">
      <form key={f.round} action={f.formAction} onSubmit={f.onSubmit} onChange={f.onChange} noValidate className="space-y-3">
        <Field label="Description" htmlFor="exp-description" required error={f.errors.description}>
          <Input id="exp-description" name="description" placeholder="Enter description" aria-invalid={f.errors.description ? true : undefined} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Field label="Category" htmlFor="exp-account" required error={f.errors.accountId}>
            <Select id="exp-account" name="accountId" options={categories} placeholder="Select category" aria-invalid={f.errors.accountId ? true : undefined} />
          </Field>
          <Field label="Amount ₹" htmlFor="exp-amount" required error={f.errors.amount}>
            <Input id="exp-amount" name="amount" inputMode="decimal" placeholder="Enter amount" aria-invalid={f.errors.amount ? true : undefined} />
          </Field>
        </div>
        <Field label="Receipt" htmlFor="receipt" error={f.errors.receipt} hint="Optional. A photo or PDF of the bill.">
          <PhotoInput name="receipt" max={1} allowUpload accept="image/*,application/pdf" invalid={Boolean(f.errors.receipt)} />
        </Field>
        <Button type="submit" className="w-full" disabled={f.pending}>
          {f.pending && <Loader2 className="size-4 animate-spin" />}
          Post to cash book
        </Button>
        <p className="text-center text-xs text-text-muted">Posts instantly as money out in the ledger and updates the live balance.</p>
      </form>
    </Panel>
  );
}

// ─── Deposit cash to Head Office bank ─────────────────────────────────────────

export function DepositCard({ action, banks }: { action: Action; banks: Option[] }) {
  const f = useResettingForm(action);
  return (
    <Panel title="Deposit cash to Head Office bank" badge={<Landmark className="size-4 text-text-muted" />}>
      <form key={f.round} action={f.formAction} onSubmit={f.onSubmit} onChange={f.onChange} noValidate className="space-y-3">
        <Field label="Bank account" htmlFor="dep-bank" required error={f.errors.bankAccountId}>
          <Select id="dep-bank" name="bankAccountId" options={banks} placeholder={banks.length ? "Select bank account" : "No bank accounts set up"} aria-invalid={f.errors.bankAccountId ? true : undefined} />
        </Field>
        <Field label="Amount ₹" htmlFor="dep-amount" required error={f.errors.amount}>
          <Input id="dep-amount" name="amount" inputMode="decimal" placeholder="Enter amount" aria-invalid={f.errors.amount ? true : undefined} />
        </Field>
        <Field label="Remarks" htmlFor="dep-remarks" error={f.errors.remarks}>
          <Textarea id="dep-remarks" name="remarks" rows={2} placeholder="Enter remarks" />
        </Field>
        <Field label="Deposit receipt" htmlFor="receipt" error={f.errors.receipt} hint="Optional. The bank slip or a photo of it.">
          <PhotoInput name="receipt" max={1} allowUpload accept="image/*,application/pdf" invalid={Boolean(f.errors.receipt)} />
        </Field>
        <Button type="submit" variant="navy" className="w-full" disabled={f.pending}>
          {f.pending && <Loader2 className="size-4 animate-spin" />}
          Record deposit
        </Button>
        <p className="text-center text-xs text-text-muted">A transfer, not income or expense: branch cash goes down and the Head Office bank goes up.</p>
      </form>
    </Panel>
  );
}

// ─── End of day: reconcile & close ────────────────────────────────────────────

type ReconcileProps = {
  action: Action;
  date: string;
  crmBalancePaise: number;
  /** An earlier day with cash movement that was never closed. */
  unclosedBefore: string | null;
};

export function ReconcileCard({ action, date, crmBalancePaise, unclosedBefore }: ReconcileProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => {
      const e: Record<string, string[]> = {};
      const p = parseRupees(String(fd.get("physical") ?? ""));
      if (String(fd.get("physical") ?? "").trim() === "" || p === null) e.physical = ["Enter the cash counted in the box"];
      else if (p !== crmBalancePaise && String(fd.get("remarks") ?? "").trim() === "") e.remarks = ["Explain the difference between the count and the CRM balance"];
      return Object.keys(e).length ? e : null;
    },
  });
  const [physical, setPhysical] = useState("");
  const [confirming, setConfirming] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const confirmed = useRef<HTMLInputElement>(null);

  // After each server reply the next submit needs a fresh confirmation.
  useEffect(() => {
    if (confirmed.current) confirmed.current.value = "";
  }, [state]);

  const counted = physical.trim() === "" ? null : parseRupees(physical);
  const variance = counted === null ? null : counted - crmBalancePaise;

  return (
    <Panel title="End of day — reconcile & close" badge={<span className="rounded-full bg-warning/10 px-2 py-0.5 text-[11px] font-semibold text-warning">mandatory</span>}>
      <p className="mb-3 text-xs text-text-muted">
        Count the physical cash in the box, enter it below and check it against the CRM balance. Once closed, this day is read-only and tomorrow&apos;s opening balance carries from it.
      </p>
      {unclosedBefore && (
        <p className="mb-3 rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {unclosedBefore} was never closed. Open that day with the date picker and close it too.
        </p>
      )}
      <form
        ref={form}
        action={formAction}
        onSubmit={(e) => {
          // The confirmation step: the first submit only asks; the confirmed one goes to the server.
          if (confirmed.current?.value !== "yes") {
            onSubmit(e);
            if (!e.defaultPrevented) {
              e.preventDefault();
              setConfirming(true);
            }
            return;
          }
        }}
        onChange={onChange}
        noValidate
        className="space-y-3"
      >
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="expectedBalance" value={crmBalancePaise} />
        <input ref={confirmed} type="hidden" name="confirmed" defaultValue="" />
        <div className="flex items-center justify-between rounded-lg bg-surface-muted px-3 py-2.5 text-sm">
          <span className="text-text-muted">CRM cash balance</span>
          <span className="font-bold tabular-nums">{formatPaise(crmBalancePaise)}</span>
        </div>
        <Field label="Physical cash counted ₹" htmlFor="physical" required error={errors.physical}>
          <Input id="physical" name="physical" inputMode="decimal" value={physical} onChange={(e) => setPhysical(e.target.value)} placeholder="Enter amount counted" aria-invalid={errors.physical ? true : undefined} />
        </Field>
        {variance !== null && (
          <p
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              variance === 0 ? "bg-success/10 text-success" : "bg-danger/5 text-danger",
            )}
          >
            {variance === 0 ? <CheckCircle2 className="size-4" /> : null}
            {variance === 0 ? "Matches the CRM balance" : `${variance < 0 ? "Short" : "Over"} by ${formatPaise(Math.abs(variance))}`}
          </p>
        )}
        <Field
          label="Remarks"
          htmlFor="close-remarks"
          required={variance !== null && variance !== 0}
          error={errors.remarks}
          hint={variance ? "Required: explain the difference. It is booked to Other Expenses so the books match the box." : undefined}
        >
          <Textarea id="close-remarks" name="remarks" rows={2} placeholder="Enter remarks" aria-invalid={errors.remarks ? true : undefined} />
        </Field>
        {state.message && !state.ok && <p className="rounded-md bg-danger/5 px-3 py-2 text-sm text-danger">{state.message}</p>}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
          Reconcile &amp; close day
        </Button>

        {confirming && (
          <div role="alertdialog" aria-label="Confirm day close" className="space-y-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
            <p className="font-semibold text-text">Close {date}?</p>
            <p className="text-text-muted">
              CRM {formatPaise(crmBalancePaise)} · counted {counted === null ? "—" : formatPaise(counted)}
              {variance ? ` · ${variance < 0 ? "short" : "over"} ${formatPaise(Math.abs(variance))}` : " · matched"}. After closing, nothing on this day can be added, edited or deleted.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="navy"
                onClick={() => {
                  setConfirming(false);
                  if (confirmed.current) confirmed.current.value = "yes";
                  form.current?.requestSubmit();
                }}
              >
                Yes, close the day
              </Button>
            </div>
          </div>
        )}
      </form>
    </Panel>
  );
}

// ─── Closed day: read-only summary ────────────────────────────────────────────

export function ClosedDayCard({ crmPaise, physicalPaise, variancePaise, remarks, closedBy, closedAt, varianceEntryNo }: {
  crmPaise: number;
  physicalPaise: number;
  variancePaise: number;
  remarks: string | null;
  closedBy: string | null;
  closedAt: string;
  varianceEntryNo: string | null;
}) {
  return (
    <Panel title="Day reconciled & closed" badge={<Lock className="size-4 text-text-muted" />}>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">CRM cash balance</dt>
          <dd className="tabular-nums">{formatPaise(crmPaise)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-text-muted">Cash counted</dt>
          <dd className="tabular-nums">{formatPaise(physicalPaise)}</dd>
        </div>
        <div className="flex justify-between gap-3 font-semibold">
          <dt>Difference</dt>
          <dd className={cn("tabular-nums", variancePaise === 0 ? "text-success" : "text-danger")}>
            {variancePaise === 0 ? "None" : `${variancePaise < 0 ? "Short" : "Over"} ${formatPaise(Math.abs(variancePaise))}`}
          </dd>
        </div>
        {varianceEntryNo && <p className="text-xs text-text-muted">Difference booked in {varianceEntryNo}.</p>}
        {remarks && <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs">{remarks}</p>}
        <p className="text-xs text-text-muted">
          Closed by {closedBy ?? "—"} · {closedAt}
        </p>
      </dl>
      <p className="mt-3 text-xs text-text-muted">This day is read-only. Corrections go through a reversal by Finance, posted on the day it is made.</p>
    </Panel>
  );
}
