"use client";

import { CircleCheck, FlaskConical } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { chipHandoffSchema, transferToChipSchema } from "../case-schema";

/** Pending approval on a chip-level quote: the branch records that the customer approved it. */
export function ChipCustomerApprovalDialog({ jobsheetNo, action }: { jobsheetNo: string; action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog
      trigger={
        <>
          <CircleCheck className="size-4" /> Customer approved
        </>
      }
      triggerVariant="navy"
      title={`Customer approved — ${jobsheetNo}`}
      description="Records the customer's approval of the chip-level quote. The Transfer to Chip-Level Lab button then appears."
      action={action}
      validate={(fd) => validateForm(transferToChipSchema, fd)}
      submitLabel="Record approval"
    >
      {(errors) => (
        <Field label="Note" htmlFor="note" error={errors.note} hint="Shown on the timeline, e.g. how they confirmed">
          <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
        </Field>
      )}
    </ActionDialog>
  );
}

/** Chip-level case, customer approved: replaces "Move to Awaiting stock" and sends the case to the lab. */
export function ChipTransferDialog({ action }: { action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog
      trigger={
        <>
          <FlaskConical className="size-4" /> Transfer to Chip-Level Lab (Head Office)
        </>
      }
      triggerVariant="navy"
      title="Transfer to Chip-Level Lab (Head Office)"
      description="The customer has approved. The case enters the Head Office chip-level lab incoming queue, and the lab receives and diagnoses it."
      action={action}
      validate={(fd) => validateForm(transferToChipSchema, fd)}
      submitLabel="Transfer to lab"
    >
      {(errors) => (
        <Field label="Note" htmlFor="note" error={errors.note} hint="Shown on the timeline">
          <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
        </Field>
      )}
    </ActionDialog>
  );
}

/** Maximum estimate, dead risk and note: what the customer approves before the case goes to the lab. */
export function ChipHandoffFields({ errors, noteLabel = "Note" }: { errors: Record<string, string[] | undefined>; noteLabel?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <Field label="Maximum estimate amount" htmlFor="chipMaxEstimate" required error={errors.chipMaxEstimate}>
          <Input id="chipMaxEstimate" name="chipMaxEstimate" placeholder="Enter maximum estimate amount" inputMode="decimal" aria-invalid={errors.chipMaxEstimate ? true : undefined} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-muted px-4 py-3 hover:bg-surface-soft">
          <input type="checkbox" name="chipDeadRisk" value="on" className="mt-0.5 size-4 accent-primary" />
          <p className="text-sm font-medium">Dead risk — device may be beyond repair</p>
        </label>
      </div>
      <Field label={noteLabel} htmlFor="note" error={errors.note} hint="Shown on the timeline">
        <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
      </Field>
    </>
  );
}

type ChipBranchActionsProps = {
  status: string;
  hasChipHistory: boolean;
  /** Chip-level service was planned at diagnosis: the transfer waits for the customer's approval. */
  chipPlanned?: boolean;
  chipApproved?: boolean;
  /** Quality Check runs in the checklist popup, which already offers the send-to-lab option. */
  qcInModal?: boolean;
  requestChipApproval: (prev: FormState, formData: FormData) => Promise<FormState>;
  sendBackToChipLab: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/**
 * Branch-side chip-level dialogs on the case page. Rendered as a Client Component
 * so that ActionDialog's function children are not passed across the server boundary.
 */
export function ChipBranchActions({
  status,
  hasChipHistory,
  chipPlanned = false,
  chipApproved = false,
  qcInModal = false,
  requestChipApproval,
  sendBackToChipLab,
}: ChipBranchActionsProps) {
  return (
    <>
      {/* Chip-level cases transfer from the main action slot once the customer approved (ChipTransferDialog). */}
      {!hasChipHistory && !chipPlanned && (status === "DIAGNOSIS" || (status === "QUALITY_CHECK" && !qcInModal)) && (
        <ActionDialog
          trigger={<><FlaskConical className="size-4" /> Send to Chip-Level Lab</>}
          triggerVariant="secondary"
          title="Send to Chip-Level Lab"
          description="Enter the maximum estimate for the customer to approve. The case moves to the lab only after they approve."
          action={requestChipApproval}
          validate={(fd) => validateForm(chipHandoffSchema, fd)}
          submitLabel="Send for Customer Approval"
        >
          {(errors) => <ChipHandoffFields errors={errors} />}
        </ActionDialog>
      )}

      {status === "QUALITY_CHECK" && !qcInModal && hasChipHistory && (
        <ActionDialog
          trigger={<><FlaskConical className="size-4" /> Send Back to Chip-Level Lab</>}
          triggerVariant="secondary"
          title="Send back to chip-level lab"
          description="QC failed — the device will return to the chip-level lab for further repair."
          action={sendBackToChipLab}
          submitLabel="Confirm send-back"
        >
          {(errors) => (
            <Field label="Reason / Note" htmlFor="note" error={errors.note} hint="Shown on the timeline">
              <Textarea id="note" name="note" rows={2} placeholder="Enter reason" />
            </Field>
          )}
        </ActionDialog>
      )}
    </>
  );
}
