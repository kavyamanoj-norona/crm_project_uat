"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SUPPLIER_FIELDS, supplierSchema } from "../supplier-schema";
import { INVENTORY_PATHS } from "../paths";

export type SupplierFormValues = Record<string, string>;

type SupplierFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: SupplierFormValues;
  id?: string;
};

export function SupplierForm({ action, initial, id }: SupplierFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(supplierSchema, fd, SUPPLIER_FIELDS),
  });
  const v: SupplierFormValues = state.values ?? initial ?? {};

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
        <Field label="Supplier name" htmlFor="name" required error={errors.name}>
          <Input {...f("name")} placeholder="Enter supplier name" />
        </Field>
        <Field label="GSTIN" htmlFor="gstin" error={errors.gstin}>
          <Input {...f("gstin")} placeholder="Enter GSTIN" />
        </Field>
        <Field label="State" htmlFor="state" error={errors.state}>
          <Input {...f("state")} placeholder="Enter state" />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone}>
          <Input {...f("phone")} placeholder="Enter phone number" />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input {...f("email")} type="email" autoComplete="off" placeholder="Enter email" />
        </Field>
        <Field label="Address" htmlFor="address" error={errors.address} className="sm:col-span-2 lg:col-span-3">
          <Textarea {...f("address")} placeholder="Enter address" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={INVENTORY_PATHS.suppliers} variant="secondary">
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
