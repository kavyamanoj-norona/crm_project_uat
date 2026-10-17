"use client";

import { Building2 } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Select, Textarea } from "@/components/ui/field";
import { officeConsumeSchema } from "../office-schema";

type Props = {
  usid: string;
  itemName: string;
  employees: { value: string; label: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Consume" on an office-use unit: pick the employee it goes to and say what it is for. */
export function OfficeConsumeDialog({ usid, itemName, employees, action }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <Building2 className="size-3.5" /> Consume
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title={`Consume ${usid} for office use`}
      description={`${itemName}. This cannot be undone.`}
      action={action}
      validate={(fd) => validateForm(officeConsumeSchema, fd)}
      submitLabel="Confirm consume"
    >
      {(errors) => (
        <>
          <Field label="Employee" htmlFor={`office-emp-${usid}`} required error={errors.employeeId}>
            <Select id={`office-emp-${usid}`} name="employeeId" options={employees} placeholder="Select employee" aria-invalid={errors.employeeId ? true : undefined} />
          </Field>
          <Field label="Remarks" htmlFor={`office-remarks-${usid}`} required error={errors.remarks} hint="What it is used for, for example reception printer.">
            <Textarea id={`office-remarks-${usid}`} name="remarks" rows={3} placeholder="Enter remarks" aria-invalid={errors.remarks ? true : undefined} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
