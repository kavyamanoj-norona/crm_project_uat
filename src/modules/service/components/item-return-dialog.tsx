"use client";

import { Undo2 } from "lucide-react";
import { validateForm, type FormState } from "@/lib/form";
import { ActionDialog } from "@/components/forms/action-dialog";
import { PhotoInput } from "@/components/forms/photo-input";
import { enumOptions } from "@/lib/enum";
import { Field, Select, Textarea } from "@/components/ui/field";
import { RETURN_TYPES, RETURN_TYPE_LABELS, itemReturnSchema } from "../case-schema";

const typeOptions = enumOptions(RETURN_TYPES, RETURN_TYPE_LABELS);

type ItemReturnDialogProps = {
  itemName: string;
  /** Warranty status of this item, so the hint and the Warranty claim choice match what the server will accept. */
  warranty: { covered: boolean; hint: string };
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
};

/** "Return" button for a part on a closed case: mandatory notes, optional uploaded or camera photos. */
export function ItemReturnDialog({ itemName, warranty, action }: ItemReturnDialogProps) {
  return (
    <ActionDialog
      trigger={
        <>
          <Undo2 className="size-4" />
          Return
        </>
      }
      triggerVariant="secondary"
      title={`Return ${itemName}`}
      description="Choose the return type, add the reason and attach photos of the item."
      action={action}
      validate={(fd) => {
        const errors: Record<string, string[] | undefined> = { ...validateForm(itemReturnSchema, fd) };
        if (fd.get("returnType") === "WARRANTY_CLAIM" && !warranty.covered) errors.returnType = [warranty.hint];
        return Object.keys(errors).length > 0 ? errors : null;
      }}
      submitLabel="Submit return"
    >
      {(errors) => (
        <>
          <Field label="Return type" htmlFor="returnType" required error={errors.returnType} hint={warranty.hint}>
            <Select
              id="returnType"
              name="returnType"
              options={typeOptions}
              placeholder="Select return type"
              aria-invalid={errors.returnType ? true : undefined}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" required error={errors.notes}>
            <Textarea id="notes" name="notes" rows={4} aria-invalid={errors.notes ? true : undefined} placeholder="Enter return notes" />
          </Field>
          <Field label="Photos" htmlFor="photos" hint="Upload images or take photos with the camera">
            <PhotoInput name="photos" allowUpload />
          </Field>
        </>
      )}
    </ActionDialog>
  );
}
