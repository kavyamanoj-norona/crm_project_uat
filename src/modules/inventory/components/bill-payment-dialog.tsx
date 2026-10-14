"use client";

import { IndianRupee } from "lucide-react";
import type { FormState } from "@/lib/form";
import { validateForm } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { BILL_PAYMENT_MODES, BILL_PAYMENT_MODE_LABELS, billPaymentSchema } from "../billing-schema";

type BillPaymentDialogProps = {
  billCode: string;
  dueLabel: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Add payment" for a bill that still has a balance. */
export function BillPaymentDialog({ billCode, dueLabel, action }: BillPaymentDialogProps) {
  return (
    <ActionDialog
      trigger={
        <>
          <IndianRupee className="size-4" />
          Add payment
        </>
      }
      triggerVariant="primary"
      title={`Payment for ${billCode}`}
      description={`Balance due ${dueLabel}.`}
      action={action}
      validate={(fd) => validateForm(billPaymentSchema, fd)}
      submitLabel="Record payment"
    >
      {(errors) => (
        <>
          <Field label="Amount ₹" htmlFor="amount" required error={errors.amount}>
            <Input id="amount" name="amount" inputMode="decimal" placeholder="Enter amount" aria-invalid={errors.amount ? true : undefined} />
          </Field>
          <Field label="Payment mode" htmlFor="mode" required error={errors.mode}>
            <Select
              id="mode"
              name="mode"
              options={BILL_PAYMENT_MODES.map((m) => ({ value: m, label: BILL_PAYMENT_MODE_LABELS[m] }))}
              placeholder="Select payment mode"
              aria-invalid={errors.mode ? true : undefined}
            />
          </Field>
          <Field label="Reference number" htmlFor="referenceNo" error={errors.referenceNo}>
            <Input id="referenceNo" name="referenceNo" placeholder="Enter reference number" />
          </Field>
          <Field label="Note" htmlFor="note" error={errors.note}>
            <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
