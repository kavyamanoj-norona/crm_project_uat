"use client";

import { Check, Send, X } from "lucide-react";
import type { FormState } from "@/lib/form";
import { validateForm } from "@/lib/form";
import { Field, Textarea } from "@/components/ui/field";
import { ActionDialog } from "@/components/forms/action-dialog";
import { approvalDecisionSchema } from "../case-schema";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

const validate = (fd: FormData) => validateForm(approvalDecisionSchema, fd);

const remarksField = (id: string, hint?: string) => {
  function RemarksField(errors: Record<string, string[] | undefined>) {
    return (
      <Field label="Remarks" htmlFor={id} required error={errors.remarks} hint={hint}>
        <Textarea id={id} name="remarks" rows={3} autoFocus aria-invalid={errors.remarks ? true : undefined} placeholder="Enter remarks" />
      </Field>
    );
  }
  return RemarksField;
};

/** Inbox row, lab quote waiting at the branch: send it to the customer with remarks. */
export function SendToCustomerDialog({ jobsheetNo, action }: { jobsheetNo: string; action: Action }) {
  return (
    <ActionDialog
      trigger={
        <>
          <Send className="size-4" /> Send to customer
        </>
      }
      triggerVariant="primary"
      triggerSize="sm"
      title={`Send quote to customer — ${jobsheetNo}`}
      description="The chip-level lab's estimate is above the case total, so the customer has to approve it before servicing starts."
      action={action}
      validate={validate}
      submitLabel="Send quote"
    >
      {remarksField(`send-${jobsheetNo}`, "Kept with the quote and shown to the lab")}
    </ActionDialog>
  );
}

/** Inbox row, quote with the customer: record what they answered. The lab is updated straight away. */
export function CustomerDecisionDialogs({ jobsheetNo, approve, reject }: { jobsheetNo: string; approve: Action; reject: Action }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <ActionDialog
        trigger={
          <>
            <Check className="size-4" /> Customer approved
          </>
        }
        triggerVariant="success"
        triggerSize="sm"
        title={`Customer approved — ${jobsheetNo}`}
        description="The chip-level lab is told and can start servicing."
        action={approve}
        validate={validate}
        submitLabel="Record approval"
      >
        {remarksField(`cust-approve-${jobsheetNo}`)}
      </ActionDialog>
      <ActionDialog
        trigger={
          <>
            <X className="size-4" /> Customer rejected
          </>
        }
        triggerVariant="danger"
        triggerSize="sm"
        title={`Customer rejected — ${jobsheetNo}`}
        description="The case goes back to the chip-level lab's diagnosis."
        action={reject}
        validate={validate}
        submitLabel="Record rejection"
        submitVariant="danger"
      >
        {remarksField(`cust-reject-${jobsheetNo}`)}
      </ActionDialog>
    </div>
  );
}
