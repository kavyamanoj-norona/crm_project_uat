"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { VENDOR_FIELDS, vendorSchema } from "../vendor-schema";
import { SERVICE_PATHS } from "../paths";

export type VendorFormValues = Record<string, string>;

type VendorFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: VendorFormValues;
  id?: string;
};

export function VendorForm({ action, initial, id }: VendorFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(vendorSchema, fd, VENDOR_FIELDS),
  });
  const v: VendorFormValues = state.values ?? initial ?? {};

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Vendor name" htmlFor="name" required error={errors.name}>
          <Input {...f("name")} placeholder="Enter vendor name" />
        </Field>
        <Field label="Contact name" htmlFor="contactName" error={errors.contactName}>
          <Input {...f("contactName")} placeholder="Enter contact name" />
        </Field>
        <Field label="Contact number" htmlFor="phone" required error={errors.phone}>
          <Input {...f("phone")} type="tel" inputMode="numeric" placeholder="Enter contact number" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input {...f("email")} type="email" autoComplete="off" placeholder="Enter email" />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address}>
          <Input {...f("address")} placeholder="Enter address" />
        </Field>
        <Field label="Remarks" htmlFor="remarks" error={errors.remarks} className="lg:col-span-3">
          <Textarea {...f("remarks")} placeholder="Enter remarks" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={SERVICE_PATHS.vendors} variant="secondary">
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
