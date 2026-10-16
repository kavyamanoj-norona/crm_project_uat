"use client";

import { Undo2 } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form";

const REASONS = [
  { value: "UNUSED", label: "Not needed (unused)" },
  { value: "COURIER_DAMAGE", label: "Courier / Branch damage" },
  { value: "DEFECTIVE", label: "Defective / Not working" },
];

/** "Return" on a case line: a received part goes back to Head Office before the case closes. */
export function ReturnPartDialog({ itemName, action }: { itemName: string; action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog
      trigger={
        <>
          <Undo2 className="size-3.5" /> Return
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Return this item?"
      description={itemName}
      action={action}
      validate={(fd) => {
        const errors: Record<string, string[]> = {};
        if (!String(fd.get("reason") ?? "")) errors.reason = ["Select a return reason"];
        if (String(fd.get("remarks") ?? "").trim().length < 3) errors.remarks = ["Add remarks explaining the return"];
        return Object.keys(errors).length ? errors : null;
      }}
      submitLabel="Confirm return"
    >
      {(errors) => (
        <>
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            The received unit goes back to Head Office and leaves this branch&apos;s stock. <strong>Courier / Branch damage</strong>: the USID goes to the
            Purchase Returns tab and a replacement is bought. <strong>Defective / Not working</strong>: the USID is sent to the vendor for replacement
            and the same USID is reused. A replacement request is raised automatically. Unused items return to Head Office stock.
          </p>
          <Field label="Return reason" htmlFor="return-reason" required error={errors.reason}>
            <Select id="return-reason" name="reason" options={REASONS} placeholder="Select return reason" aria-invalid={errors.reason ? true : undefined} />
          </Field>
          <Field label="Remarks" htmlFor="return-remarks" required error={errors.remarks}>
            <Textarea id="return-remarks" name="remarks" rows={3} placeholder="Enter remarks" aria-invalid={errors.remarks ? true : undefined} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
