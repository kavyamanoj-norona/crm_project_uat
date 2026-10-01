"use client";

import { ArrowRight, Ban, Shuffle } from "lucide-react";
import type { ActionResult, FormState } from "@/lib/form";
import { validateForm } from "@/lib/form";
import { buttonClass } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { ActionDialog } from "@/components/forms/action-dialog";
import { CASE_FLOW, CASE_STATUS_LABELS, cancelSchema, stageChangeSchema, type CaseStatusValue } from "../case-schema";

type StageActionsProps = {
  jobsheetNo: string;
  status: CaseStatusValue;
  next: CaseStatusValue | null;
  moveNext: () => Promise<ActionResult>;
  changeStage: (prev: FormState, formData: FormData) => Promise<FormState>;
  cancel: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Replaces the "Move to …" button, e.g. the Start diagnosis dialog at Intake. */
  primary?: React.ReactNode;
};

/** Header buttons on the case page: Cancel · Change stage · Move to <next> →. */
export function StageActions({ jobsheetNo, status, next, moveNext, changeStage, cancel, primary }: StageActionsProps) {
  const others = CASE_FLOW.filter((s) => s !== status).map((s) => ({ value: s, label: CASE_STATUS_LABELS[s] }));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActionDialog
        trigger={
          <>
            <Ban className="size-4" /> Cancel case
          </>
        }
        title={`Cancel ${jobsheetNo}?`}
        description="The case leaves every open queue. The reason is kept on the timeline."
        action={cancel}
        validate={(fd) => validateForm(cancelSchema, fd)}
        submitLabel="Cancel case"
        submitVariant="danger"
      >
        {(errors) => (
          <Field label="Reason" htmlFor="reason" required error={errors.reason}>
            <Textarea id="reason" name="reason" rows={3} autoFocus aria-invalid={errors.reason ? true : undefined} placeholder="Customer declined the repair quote" />
          </Field>
        )}
      </ActionDialog>

      {status !== "INTAKE" && (
        <ActionDialog
          trigger={
            <>
              <Shuffle className="size-4" /> Change stage
            </>
          }
          title="Change stage"
          description={`Now: ${CASE_STATUS_LABELS[status]}. Use this to skip a stage or step back.`}
          action={changeStage}
          validate={(fd) => validateForm(stageChangeSchema, fd)}
          submitLabel="Move case"
        >
          {(errors) => (
            <>
              <Field label="Move to" htmlFor="toStatus" required error={errors.toStatus}>
                <Select id="toStatus" name="toStatus" options={others} defaultValue={next ?? ""} aria-invalid={errors.toStatus ? true : undefined} />
              </Field>
              <Field label="Note" htmlFor="note" error={errors.note} hint="Shown on the timeline">
                <Textarea id="note" name="note" rows={2} />
              </Field>
            </>
          )}
        </ActionDialog>
      )}

      {primary ?? (next && (
        <ActionButton action={moveNext} label={`Move to ${CASE_STATUS_LABELS[next]}`} className={buttonClass("navy")}>
          <span className="inline-flex items-center gap-2">
            Move to {CASE_STATUS_LABELS[next]} <ArrowRight className="size-4" />
          </span>
        </ActionButton>
      ))}
    </div>
  );
}
