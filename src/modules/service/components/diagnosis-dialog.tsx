"use client";

import { ClipboardPen } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { DIAGNOSIS_FIELDS, diagnosisSchema } from "../engineer-schema";

type Props = {
  jobsheetNo: string;
  /** Server action already bound to the case. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: { details: string; findings: string; recommendedRepairs: string } | null;
};

/** The engineer's diagnosis of the case: details, findings and the repairs recommended. */
export function DiagnosisDialog({ jobsheetNo, action, initial }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <ClipboardPen className="size-3.5" />
          {initial ? "Edit diagnosis" : "Add diagnosis"}
        </>
      }
      triggerVariant={initial ? "secondary" : "primary"}
      triggerSize="sm"
      size="lg"
      title={`Diagnosis — ${jobsheetNo}`}
      description="Record what you examined, what you found and the repairs you recommend. The front desk uses it for the estimate."
      action={action}
      validate={(fd) => validateForm(diagnosisSchema, fd, DIAGNOSIS_FIELDS)}
      submitLabel="Save diagnosis"
    >
      {(errors) => (
        <>
          <Field label="Diagnosis details" htmlFor="dx-details" required error={errors.details} hint="Tests run and symptoms observed.">
            <Textarea id="dx-details" name="details" rows={3} defaultValue={initial?.details ?? ""} placeholder="Enter diagnosis details" />
          </Field>
          <Field label="Findings" htmlFor="dx-findings" required error={errors.findings}>
            <Textarea id="dx-findings" name="findings" rows={3} defaultValue={initial?.findings ?? ""} placeholder="Enter findings" />
          </Field>
          <Field label="Recommended repairs" htmlFor="dx-repairs" required error={errors.recommendedRepairs}>
            <Textarea id="dx-repairs" name="recommendedRepairs" rows={3} defaultValue={initial?.recommendedRepairs ?? ""} placeholder="Enter recommended repairs" />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
