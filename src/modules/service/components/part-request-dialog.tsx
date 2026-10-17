"use client";

import { ShoppingCart } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { PhotoInput } from "@/components/forms/photo-input";
import { Field, Input, Textarea } from "@/components/ui/field";
import { partRequestSchema } from "@/modules/inventory/schemas";

type PartRequestDialogProps = {
  itemName: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Request" button for an out-of-stock part: model number required, notes and photos optional. */
export function PartRequestDialog({ itemName, action }: PartRequestDialogProps) {
  return (
    <ActionDialog
      trigger={
        <>
          <ShoppingCart className="size-3.5" /> Request
        </>
      }
      triggerVariant="danger"
      triggerSize="sm"
      title={`Request ${itemName}`}
      description="Enter the model number. A photo of the part needed is optional."
      action={action}
      validate={(fd) => validateForm(partRequestSchema, fd)}
      submitLabel="Submit request"
    >
      {(errors) => (
        <>
          <Field label="Model number" htmlFor="modelNo" required error={errors.modelNo}>
            <Input id="modelNo" name="modelNo" placeholder="Enter model number" aria-invalid={errors.modelNo ? true : undefined} />
          </Field>
          <Field label="Notes" htmlFor="notes" error={errors.notes}>
            <Textarea id="notes" name="notes" rows={3} placeholder="Enter notes" />
          </Field>
          <Field label="Photos" htmlFor="photos" error={errors.photos}>
            <PhotoInput name="photos" allowUpload invalid={Boolean(errors.photos)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
