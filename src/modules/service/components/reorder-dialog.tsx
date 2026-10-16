"use client";

import { RefreshCw } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form";

/**
 * "Reorder" on an item whose earlier unit was already transferred: confirms before creating a repeat request,
 * and records why (the reason is shown to the Purchase Manager on a Replacement / Reorder request).
 */
export function ReorderDialog({ itemName, action }: { itemName: string; action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog
      trigger={
        <>
          <RefreshCw className="size-3.5" />
          Reorder
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Reorder this item?"
      description={itemName}
      action={action}
      validate={(fd) => (String(fd.get("reason") ?? "").trim().length < 5 ? { reason: ["Explain why it needs to be reordered"] } : null)}
      submitLabel="Confirm reorder"
    >
      {(errors) => (
        <>
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            A unit of this item was already transferred for this case. Reorder only if it is defective or not working. This creates a new
            <strong> Replacement / Reorder</strong> request for the Purchase Manager, with your name and the reason below.
          </p>
          <Field label="Reason for reorder" htmlFor="reorder-reason" required error={errors.reason}>
            <Textarea id="reorder-reason" name="reason" rows={3} placeholder="Enter reason" aria-invalid={errors.reason ? true : undefined} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
