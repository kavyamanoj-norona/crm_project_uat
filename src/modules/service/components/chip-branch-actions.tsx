"use client";

import { FlaskConical } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { transferToChipSchema } from "../case-schema";

type ChipBranchActionsProps = {
  status: string;
  hasChipHistory: boolean;
  /** Quality Check runs in the checklist popup, which already offers the send-to-lab option. */
  qcInModal?: boolean;
  transferToChipLab: (prev: FormState, formData: FormData) => Promise<FormState>;
  sendBackToChipLab: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/**
 * Branch-side chip-level dialogs on the case page. Rendered as a Client Component
 * so that ActionDialog's function children are not passed across the server boundary.
 */
export function ChipBranchActions({
  status,
  hasChipHistory,
  qcInModal = false,
  transferToChipLab,
  sendBackToChipLab,
}: ChipBranchActionsProps) {
  return (
    <>
      {status === "DIAGNOSIS" && !hasChipHistory && (
        <ActionDialog
          trigger={<><FlaskConical className="size-4" /> Transfer to Chip-Level Lab</>}
          triggerVariant="secondary"
          title="Transfer to Chip-Level Lab"
          description="This case will enter the chip-level lab incoming queue. The lab will receive and diagnose it."
          action={transferToChipLab}
          validate={(fd) => validateForm(transferToChipSchema, fd)}
          submitLabel="Transfer to lab"
        >
          {(errors) => (
            <Field label="Note" htmlFor="note" error={errors.note} hint="Optional — shown on the timeline">
              <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
            </Field>
          )}
        </ActionDialog>
      )}

      {status === "QUALITY_CHECK" && !qcInModal && (
        <ActionDialog
          trigger={<><FlaskConical className="size-4" /> {hasChipHistory ? "Send Back to Chip-Level Lab" : "Send to Chip-Level Lab"}</>}
          triggerVariant="secondary"
          title={hasChipHistory ? "Send back to chip-level lab" : "Send to chip-level lab"}
          description={
            hasChipHistory
              ? "QC failed — the device will return to the chip-level lab for further repair."
              : "A new issue was found — the device will go to the chip-level lab for board-level repair."
          }
          action={sendBackToChipLab}
          submitLabel={hasChipHistory ? "Confirm send-back" : "Confirm send to lab"}
        >
          {(errors) => (
            <Field label="Reason / Note" htmlFor="note" error={errors.note} hint="Optional — shown on the timeline">
              <Textarea id="note" name="note" rows={2} placeholder="Enter reason" />
            </Field>
          )}
        </ActionDialog>
      )}
    </>
  );
}
