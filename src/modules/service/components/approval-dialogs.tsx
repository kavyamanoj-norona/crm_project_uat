"use client";

import { Check, ShieldCheck, X } from "lucide-react";
import type { FormState } from "@/lib/form";
import { validateForm } from "@/lib/form";
import { Field, Textarea } from "@/components/ui/field";
import { ActionDialog } from "@/components/forms/action-dialog";
import { approvalDecisionSchema, approvalRequestSchema } from "../case-schema";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

/** Case page: the customer approved the quote some other way than WhatsApp — ask Head Office to confirm it. */
export function RequestApprovalDialog({ jobsheetNo, action }: { jobsheetNo: string; action: Action }) {
  return (
    <ActionDialog
      trigger={
        <>
          <ShieldCheck className="size-4" /> Request Head Office approval
        </>
      }
      title={`Request Head Office approval — ${jobsheetNo}`}
      description="Use this when the customer approved the quotation verbally or by other means. The case stays in Pending approval until Head Office confirms."
      action={action}
      validate={(fd) => validateForm(approvalRequestSchema, fd)}
      submitLabel="Send request"
    >
      {(errors) => (
        <Field label="Note" htmlFor="note" required error={errors.note} hint="How and when the customer confirmed">
          <Textarea id="note" name="note" rows={3} autoFocus aria-invalid={errors.note ? true : undefined} placeholder="Enter note" />
        </Field>
      )}
    </ActionDialog>
  );
}

/** Inbox row: approve or reject with remarks. */
export function DecisionDialogs({ jobsheetNo, approve, reject }: { jobsheetNo: string; approve: Action; reject: Action }) {
  const remarks = (id: string) => (errors: Record<string, string[] | undefined>) => (
    <Field label="Remarks" htmlFor={id} required error={errors.remarks}>
      <Textarea id={id} name="remarks" rows={3} autoFocus aria-invalid={errors.remarks ? true : undefined} placeholder="Enter remarks" />
    </Field>
  );
  const validate = (fd: FormData) => validateForm(approvalDecisionSchema, fd);
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      <ActionDialog
        trigger={
          <>
            <Check className="size-4" /> Approve
          </>
        }
        triggerVariant="success"
        triggerSize="sm"
        title={`Approve ${jobsheetNo}`}
        description="Confirms the customer's approval. The case moves to Awaiting stock."
        action={approve}
        validate={validate}
        submitLabel="Approve"
      >
        {remarks(`approve-${jobsheetNo}`)}
      </ActionDialog>
      <ActionDialog
        trigger={
          <>
            <X className="size-4" /> Reject
          </>
        }
        triggerVariant="danger"
        triggerSize="sm"
        title={`Reject ${jobsheetNo}`}
        description="The case stays in Pending approval. The branch can send a new request."
        action={reject}
        validate={validate}
        submitLabel="Reject"
        submitVariant="danger"
      >
        {remarks(`reject-${jobsheetNo}`)}
      </ActionDialog>
    </div>
  );
}
