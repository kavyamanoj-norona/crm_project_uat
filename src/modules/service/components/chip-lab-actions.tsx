"use client";

import { Inbox, Microscope, ClipboardCheck, Wrench, PackageCheck, XCircle, Truck } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import type { FormState } from "@/lib/form";
import type { CaseStatusValue } from "@/modules/service/case-schema";
import { QcChecklistDialog, type QcPanelItem } from "@/modules/service/components/qc-checklist-panel";
import {
  acceptLabIncoming,
  startLabDiagnosis,
  setLabPendingApproval,
  startLabServicing,
  markLabReadyToDispatch,
  startLabQualityCheck,
  completeLabTransfer,
  markNonRepairable,
  dispatchToBranch,
} from "@/modules/service/actions/chip-lab";

type ChipLabActionsProps = {
  caseId: string;
  status: CaseStatusValue;
  /** Set while the QC checklist is incomplete: Transfer to Branch then opens the checklist first. */
  /** Lab has already completed the handover to the branch. */
  transferCompleted?: boolean;
  qc?: { jobsheetNo: string; items: QcPanelItem[]; action: (prev: FormState, formData: FormData) => Promise<FormState> };
};

export function ChipLabActions({ caseId, status, qc, transferCompleted }: ChipLabActionsProps) {
  if (status === "CHIP_TRANSFER") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={acceptLabIncoming.bind(null, caseId)}
          label="Accept incoming"
          className={buttonClass("navy")}
        >
          <Inbox className="size-4" /> Accept Incoming
        </ActionButton>
      </div>
    );
  }

  if (status === "CHIP_LAB_RECEIVED") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={startLabDiagnosis.bind(null, caseId)}
          label="Start lab diagnosis"
          className={buttonClass("primary")}
        >
          <Microscope className="size-4" /> Start Diagnosis
        </ActionButton>
      </div>
    );
  }

  if (status === "CHIP_LAB_DIAGNOSIS") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionDialog
          trigger={<><ClipboardCheck className="size-4" /> Submit for Approval</>}
          title="Submit diagnosis for approval"
          description="Optionally add a note for the customer/branch."
          action={setLabPendingApproval.bind(null, caseId)}
          submitLabel="Submit"
        >
          {(errors) => (
            <Field label="Note" htmlFor="note" error={errors.note} hint="Optional — shown on the timeline">
              <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
            </Field>
          )}
        </ActionDialog>
      </div>
    );
  }

  if (status === "CHIP_LAB_PENDING_APPROVAL") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={startLabServicing.bind(null, caseId)}
          label="Start servicing"
          className={buttonClass("primary")}
        >
          <Wrench className="size-4" /> Start Servicing
        </ActionButton>
      </div>
    );
  }

  if (status === "CHIP_LAB_SERVICING") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={markLabReadyToDispatch.bind(null, caseId)}
          label="Mark ready to dispatch"
          className={buttonClass("navy")}
        >
          <PackageCheck className="size-4" /> Ready to Dispatch
        </ActionButton>
        <ActionDialog
          trigger={<><XCircle className="size-4" /> Non-Repairable</>}
          triggerVariant="danger"
          title="Mark as Non-Repairable"
          description="This cannot be undone. A mandatory reason is required."
          action={markNonRepairable.bind(null, caseId)}
          submitLabel="Confirm Non-Repairable"
          submitVariant="danger"
        >
          {(errors) => (
            <Field label="Reason" htmlFor="reason" required error={errors.reason}>
              <Textarea
                id="reason"
                name="reason"
                rows={3}
                autoFocus
                placeholder="Enter reason"
                aria-invalid={errors.reason ? true : undefined}
              />
            </Field>
          )}
        </ActionDialog>
      </div>
    );
  }

  if (status === "CHIP_LAB_READY_DISPATCH") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={startLabQualityCheck.bind(null, caseId)}
          label="Send to quality check"
          className={buttonClass("primary")}
        >
          <ClipboardCheck className="size-4" /> Quality Check
        </ActionButton>
      </div>
    );
  }

  if (status === "CHIP_BRANCH_RECEIVED") {
    if (transferCompleted) return null;
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          action={completeLabTransfer.bind(null, caseId)}
          label="Complete transfer to branch"
          className={buttonClass("navy")}
        >
          <Truck className="size-4" /> Complete Transfer
        </ActionButton>
      </div>
    );
  }

  if (status === "CHIP_LAB_QUALITY_CHECK" && qc) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <QcChecklistDialog
          trigger={<><Truck className="size-4" /> Transfer to Branch</>}
          triggerVariant="navy"
          jobsheetNo={qc.jobsheetNo}
          items={qc.items}
          action={qc.action}
        />
      </div>
    );
  }

  if (status === "CHIP_LAB_QUALITY_CHECK" || status === "NON_REPAIRABLE") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ActionDialog
          trigger={<><Truck className="size-4" /> Transfer to Branch</>}
          triggerVariant="navy"
          title="Transfer to branch"
          description="Record the dispatch. The branch will confirm receipt."
          action={dispatchToBranch.bind(null, caseId)}
          submitLabel="Confirm transfer"
        >
          {(errors) => (
            <Field label="Note" htmlFor="note" error={errors.note} hint="Optional — shown on the timeline">
              <Textarea id="note" name="note" rows={2} placeholder="Enter note" />
            </Field>
          )}
        </ActionDialog>
      </div>
    );
  }

  return null;
}
