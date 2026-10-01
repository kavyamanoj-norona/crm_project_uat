"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { StateDistrictFields } from "@/components/forms/state-district-fields";
import { CUSTOMER_FIELDS, customerSchema, customerTypeOptions, leadSourceOptions } from "../schemas";

export type CustomerFormValues = Record<string, string>;

type CustomerFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Editing: the customer's current values. New: defaults. */
  initial?: CustomerFormValues;
  id?: string;
  cancelHref: string;
};

export function CustomerForm({ action, initial, id, cancelHref }: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(customerSchema, fd, CUSTOMER_FIELDS),
  });
  const v: CustomerFormValues = state.values ?? initial ?? { type: "INDIVIDUAL", state: "Kerala" };
  const [type, setType] = useState(v.type ?? "INDIVIDUAL");

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
        <Field label="Customer type" htmlFor="type" required error={errors.type}>
          <Select {...f("type")} value={type} defaultValue={undefined} onChange={(e) => setType(e.target.value)} options={customerTypeOptions} />
        </Field>
        <Field label={type === "BUSINESS" ? "Business name" : "Name"} htmlFor="name" required error={errors.name}>
          <Input {...f("name")} placeholder={type === "BUSINESS" ? "Grand Hotel Kochi" : "Full name"} />
        </Field>
        <Field label="Phone" htmlFor="phone" required error={errors.phone} hint="Mobile, or landline with STD code">
          <Input {...f("phone")} type="tel" inputMode="tel" placeholder="98470 12345" />
        </Field>
        <Field label="Alt phone" htmlFor="altPhone" error={errors.altPhone}>
          <Input {...f("altPhone")} type="tel" inputMode="tel" />
        </Field>

        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input {...f("email")} type="email" autoComplete="off" placeholder="name@example.com" />
        </Field>
        <Field label="How did they hear about us?" htmlFor="source" error={errors.source}>
          <Select {...f("source")} options={leadSourceOptions} />
        </Field>
        {type === "BUSINESS" && (
          <Field label="GSTIN" htmlFor="gstin" error={errors.gstin}>
            <Input {...f("gstin")} className="uppercase" maxLength={15} placeholder="32ABCDE1234F1Z5" />
          </Field>
        )}
        <Field label="PIN code" htmlFor="pincode" error={errors.pincode}>
          <Input {...f("pincode")} inputMode="numeric" maxLength={6} />
        </Field>

        <StateDistrictFields state={v.state} district={v.district} errors={errors} />
        <Field label="Address" htmlFor="address" error={errors.address} className="lg:col-span-2">
          <Textarea {...f("address")} />
        </Field>
        <Field label="Notes" htmlFor="notes" error={errors.notes} className="sm:col-span-2 lg:col-span-4">
          <Textarea {...f("notes")} placeholder="Anything the next person at the counter should know" />
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
