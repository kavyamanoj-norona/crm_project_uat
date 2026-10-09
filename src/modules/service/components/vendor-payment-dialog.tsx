"use client";

import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input } from "@/components/ui/field";
import type { FormState } from "@/lib/form";

type Props = {
  jobsheetNo: string;
  /** Formatted amount still due, e.g. "₹4,000". */
  dueLabel: string;
  vendorName: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Record payment" dialog for money paid to the outsource vendor. */
export function VendorPaymentDialog({ jobsheetNo, dueLabel, vendorName, action }: Props) {
  return (
    <ActionDialog
      trigger="Record payment"
      title={`Pay vendor — ${jobsheetNo}`}
      description={`${dueLabel} is still due to ${vendorName}.`}
      action={action}
      submitLabel="Save payment"
    >
      {(errors) => (
        <>
          <Field label="Amount ₹" htmlFor="vendor-amount" required error={errors.amount}>
            <Input id="vendor-amount" name="amount" inputMode="decimal" placeholder="Enter amount" />
          </Field>
          <Field label="Note" htmlFor="vendor-note" error={errors.note}>
            <Input id="vendor-note" name="note" placeholder="Enter note" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
