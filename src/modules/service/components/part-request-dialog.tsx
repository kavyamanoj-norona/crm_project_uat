"use client";

import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { PhotoInput } from "@/components/forms/photo-input";
import { Field, Input, Textarea } from "@/components/ui/field";
import { partRequestSchema } from "@/modules/inventory/schemas";

type PartRequestDialogProps = {
  itemName: string;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Request" button for an out-of-stock part: notes optional, at least one photo mandatory. */
export function PartRequestDialog({ itemName, action }: PartRequestDialogProps) {
  return (
    <ActionDialog
      trigger="Request"
      triggerVariant="danger"
      title={`Request ${itemName}`}
      description="Enter the model number and attach a photo of the part needed.."
      action={action}
      validate={(fd) => {
        const errors: Record<string, string[] | undefined> = { ...validateForm(partRequestSchema, fd) };
        if (!fd.getAll("photos").some((f) => f instanceof File && f.size > 0)) errors.photos = ["Add at least one photo"];
        return Object.keys(errors).length > 0 ? errors : null;
      }}
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
          <Field label="Photos" htmlFor="photos" required error={errors.photos}>
            <PhotoInput name="photos" allowUpload invalid={Boolean(errors.photos)} />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
