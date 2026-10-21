"use client";

import { PhoneCall } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { CALL_FIELDS, callOutcomeOptions, callSchema, leadStatusOptions } from "../schemas";

type Props = {
  title: string;
  /** Server action already bound to the lead. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Button label. */
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  /** Branch staff don't change the lead's status from here, only the outcome and follow-up. */
  showStatus?: boolean;
};

/** Record a call: outcome, what was said, when to call again. Appended to the lead's history. */
export function CallDialog({ title, action, label = "Record call", variant = "primary", size = "sm", showStatus = true }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <PhoneCall className="size-3.5" />
          {label}
        </>
      }
      triggerVariant={variant}
      triggerSize={size}
      size="md"
      title={title}
      description="Each call is added to the lead's history; earlier calls and remarks are never changed."
      action={action}
      validate={(fd) => validateForm(callSchema, fd, CALL_FIELDS)}
      submitLabel="Save call"
    >
      {(errors) => (
        <>
          <Field label="Outcome" htmlFor="call-outcome" required error={errors.outcome}>
            <Select id="call-outcome" name="outcome" options={callOutcomeOptions} placeholder="Select outcome" aria-invalid={errors.outcome ? true : undefined} />
          </Field>
          <Field label="Remarks" htmlFor="call-remarks" error={errors.remarks}>
            <Textarea id="call-remarks" name="remarks" rows={3} placeholder="Enter remarks" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Next follow-up" htmlFor="call-next" error={errors.nextFollowUpAt} hint="Leave empty if no further call is needed.">
              <Input id="call-next" name="nextFollowUpAt" type="datetime-local" aria-invalid={errors.nextFollowUpAt ? true : undefined} />
            </Field>
            {showStatus ? (
              <Field label="Status" htmlFor="call-status" error={errors.status} hint="Left as is unless you pick one; the outcome suggests it.">
                <Select id="call-status" name="status" options={leadStatusOptions} placeholder="Select status" />
              </Field>
            ) : (
              <input type="hidden" name="status" value="" />
            )}
          </div>
        </>
      )}
    </ActionDialog>
  );
}
