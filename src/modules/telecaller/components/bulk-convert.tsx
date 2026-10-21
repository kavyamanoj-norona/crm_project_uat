"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";

export const BULK_FORM_ID = "bulk-convert-form";

type Props = {
  branches: { value: string; label: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** Number of lead checkboxes ticked in the table (they belong to this form through their `form` attribute). */
function useSelectedCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(document.querySelectorAll(`input[name="ids"][form="${BULK_FORM_ID}"]:checked`).length);
    document.addEventListener("change", update);
    update();
    return () => document.removeEventListener("change", update);
  }, []);
  return count;
}

/** "Convert selected to branch": the ticked leads become customers of the chosen branch, in place. */
export function BulkConvert({ branches, action }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const selected = useSelectedCount();

  // Untick everything once the conversion went through.
  useEffect(() => {
    if (state.ok) document.querySelectorAll<HTMLInputElement>(`input[form="${BULK_FORM_ID}"]`).forEach((i) => (i.checked = false));
  }, [state]);

  return (
    <form id={BULK_FORM_ID} action={formAction} className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <span className="text-xs text-text-muted" aria-live="polite">
        {selected} selected
      </span>
      <div className="w-full sm:w-48">
        <Select name="branchId" aria-label="Branch" options={branches} placeholder="Select branch" />
      </div>
      <Button type="submit" variant="navy" size="sm" disabled={pending || selected === 0}>
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
        Convert selected
      </Button>
      {state.message && <span className={state.ok ? "text-xs text-success" : "text-xs text-danger"}>{state.message}</span>}
    </form>
  );
}

/** Header checkbox: ticks or unticks every lead on the page. */
export function SelectAllLeads() {
  return (
    <input
      type="checkbox"
      aria-label="Select all leads on this page"
      className="size-4 accent-primary"
      onChange={(e) => {
        document.querySelectorAll<HTMLInputElement>(`input[name="ids"][form="${BULK_FORM_ID}"]:not(:disabled)`).forEach((i) => (i.checked = e.target.checked));
        document.dispatchEvent(new Event("change"));
      }}
    />
  );
}
