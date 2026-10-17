"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { ActionDialog } from "@/components/forms/action-dialog";
import { PhotoInput } from "@/components/forms/photo-input";
import { Field, Select, Textarea } from "@/components/ui/field";
import type { FormState } from "@/lib/form";

const REASONS = [
  { value: "UNUSED", label: "Not needed (unused)" },
  { value: "COURIER_DAMAGE", label: "Courier / Branch damage" },
  { value: "DEFECTIVE", label: "Defective / Not working" },
];

type Errors = Record<string, string[] | undefined>;

function Fields({ errors }: { errors: Errors }) {
  const [reason, setReason] = useState("");
  // Damage in transit or at the branch needs photo evidence; other reasons can add photos if useful.
  const photosRequired = reason === "COURIER_DAMAGE";

  return (
    <>
      <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
        The received unit goes back to Head Office and leaves this branch&apos;s stock. <strong>Courier / Branch damage</strong>: the USID goes to the
        Purchase Returns tab and a replacement is bought. <strong>Defective / Not working</strong>: the USID is sent to the vendor for replacement
        and the same USID is reused. A replacement request is raised automatically. Unused items return to Head Office stock.
      </p>
      <Field label="Return reason" htmlFor="return-reason" required error={errors.reason}>
        <Select
          id="return-reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={REASONS}
          placeholder="Select return reason"
          aria-invalid={errors.reason ? true : undefined}
        />
      </Field>
      <Field label="Remarks" htmlFor="return-remarks" required error={errors.remarks}>
        <Textarea id="return-remarks" name="remarks" rows={3} placeholder="Enter remarks" aria-invalid={errors.remarks ? true : undefined} />
      </Field>
      <Field
        label="Photos"
        htmlFor="photos"
        required={photosRequired}
        error={errors.photos}
        // hint={photosRequired ? "Required for courier / branch damage: take or upload at least one photo of the damage." : "Optional. Take a photo or upload images."}
      >
        <PhotoInput name="photos" allowUpload invalid={Boolean(errors.photos)} />
      </Field>
    </>
  );
}

/** "Return" on a case line: a received part goes back to Head Office before the case closes. */
export function ReturnPartDialog({ itemName, action }: { itemName: string; action: (prev: FormState, formData: FormData) => Promise<FormState> }) {
  return (
    <ActionDialog
      trigger={
        <>
          <Undo2 className="size-3.5" /> Return
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Return this item?"
      description={itemName}
      action={action}
      validate={(fd) => {
        const errors: Record<string, string[]> = {};
        const reason = String(fd.get("reason") ?? "");
        if (!reason) errors.reason = ["Select a return reason"];
        if (String(fd.get("remarks") ?? "").trim().length < 3) errors.remarks = ["Add remarks explaining the return"];
        const hasPhoto = fd.getAll("photos").some((f) => f instanceof File && f.size > 0);
        if (reason === "COURIER_DAMAGE" && !hasPhoto) errors.photos = ["Add at least one photo of the damage for a courier / branch damage return"];
        return Object.keys(errors).length ? errors : null;
      }}
      submitLabel="Confirm return"
    >
      {(errors) => <Fields errors={errors} />}
    </ActionDialog>
  );
}
