"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { StateDistrictFields } from "@/components/forms/state-district-fields";
import { B2B_FIELDS, b2bSchema } from "../b2b-schemas";

export type B2bFormValues = Record<string, string>;

type B2bFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Editing: the account's current values. New: defaults. */
  initial?: B2bFormValues;
  id?: string;
  cancelHref: string;
};

export function B2bForm({ action, initial, id, cancelHref }: B2bFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(b2bSchema, fd, B2B_FIELDS),
  });
  const v: B2bFormValues = state.values ?? initial ?? { state: "Kerala" };

  const f = (name: string) => ({
    id: name,
    name,
    defaultValue: v[name] ?? "",
    "aria-invalid": errors[name] ? true : undefined,
  });

  return (
    <form
      key={`${id ?? "new"}-${JSON.stringify(state.values ?? {})}`}
      action={formAction}
      onSubmit={onSubmit}
      onChange={onChange}
      className="space-y-4"
      noValidate
    >
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Business name" htmlFor="name" required error={errors.name}>
          <Input {...f("name")} placeholder="Enter business name" />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={errors.gstin}>
          <Input {...f("gstin")} className="uppercase" maxLength={15} placeholder="Enter GSTIN" />
        </Field>
        <Field label="Contact person" htmlFor="contactPerson" error={errors.contactPerson}>
          <Input {...f("contactPerson")} placeholder="Enter contact person" />
        </Field>
        <Field label="Phone" htmlFor="phone" required error={errors.phone} hint="Mobile, or landline with STD code">
          <Input {...f("phone")} type="tel" inputMode="tel" placeholder="Enter phone number" />
        </Field>
        <Field label="Alt phone" htmlFor="altPhone" error={errors.altPhone}>
          <Input {...f("altPhone")} type="tel" inputMode="tel" placeholder="Enter alternate phone" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input {...f("email")} type="email" autoComplete="off" placeholder="Enter email" />
        </Field>
        <Field label="PIN code" htmlFor="pincode" error={errors.pincode}>
          <Input {...f("pincode")} inputMode="numeric" maxLength={6} placeholder="Enter PIN code" />
        </Field>

        <StateDistrictFields state={v.state} district={v.district} errors={errors} />
        <Field label="Address" htmlFor="address" error={errors.address} className="lg:col-span-2">
          <Textarea {...f("address")} placeholder="Enter address" />
        </Field>
        <Field label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2 lg:col-span-4">
          <Textarea {...f("notes")} placeholder="Enter notes" />
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={cancelHref} variant="secondary">
            Cancel
          </LinkButton>
        ) : (
          <Button type="reset" variant="danger">
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
