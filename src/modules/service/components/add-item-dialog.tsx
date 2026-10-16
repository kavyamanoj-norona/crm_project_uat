"use client";

import { Plus } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field } from "@/components/ui/field";
import { SearchSelectField } from "@/components/forms/search-select";
import type { FormState } from "@/lib/form";

type Props = {
  options: { value: string; label: string }[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** True when adding sends the case back to diagnosis (any stage after it). */
  backToDiagnosis: boolean;
  backLabel: string;
};

/** "Add item" on a case: picks one catalog item. After diagnosis it sends the case back for customer approval. */
export function AddItemDialog({ options, action, backToDiagnosis, backLabel }: Props) {
  return (
    <ActionDialog
      trigger={
        <>
          <Plus className="size-4" /> Add item
        </>
      }
      title="Add an item to this case"
      description={backToDiagnosis ? `The case goes back to ${backLabel} so the customer can approve the new estimate before servicing continues.` : "The item is added to the estimate."}
      action={action}
      validate={(fd) => (String(fd.get("itemId") ?? "") ? null : { itemId: ["Select an item"] })}
      submitLabel="Add item"
    >
      {(errors) => (
        <>
          {backToDiagnosis && (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
              Adding an item moves this case back to <strong>{backLabel}</strong>. Servicing continues only after the customer approves.
            </p>
          )}
          <Field label="Item" htmlFor="add-item" required error={errors.itemId}>
            <SearchSelectField id="add-item" name="itemId" options={options} placeholder="Select item" invalid={Boolean(errors.itemId)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
