"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { WARRANTY_FIELDS, WARRANTY_UNITS, WARRANTY_UNIT_LABELS, warrantyName, warrantySchema, type WarrantyUnitValue } from "../warranty-schema";
import { INVENTORY_PATHS } from "../paths";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: Record<string, string>;
  id?: string;
};

export function WarrantyForm({ action, initial, id }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state, validate: (fd) => validateForm(warrantySchema, fd, WARRANTY_FIELDS) });
  const v: Record<string, string> = state.values ?? initial ?? {};
  // The name shown on bills is made from these two, so show it as the user types.
  const [typed, setTyped] = useState<{ value: string; unit: string }>({ value: v.durationValue ?? "", unit: v.durationUnit ?? "" });
  const value = Number(typed.value);
  const preview = Number.isInteger(value) && value >= 1 && typed.unit ? warrantyName(value, typed.unit as WarrantyUnitValue) : null;
  const f = (name: string) => ({ id: name, name, defaultValue: v[name] ?? "", "aria-invalid": errors[name] ? true : undefined });

  return (
    <form key={`${id ?? "new"}-${JSON.stringify(state.values ?? {})}`} action={formAction} onSubmit={onSubmit} onChange={onChange} className="space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Duration" htmlFor="durationValue" required error={errors.durationValue} hint={preview ? `Shown on purchase bills as "${preview}".` : "How long the warranty lasts, for example 6."}>
          <Input
            {...f("durationValue")}
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="Enter duration"
            onChange={(e) => setTyped((t) => ({ ...t, value: e.target.value }))}
          />
        </Field>
        <Field label="Unit" htmlFor="durationUnit" required error={errors.durationUnit}>
          <Select
            id="durationUnit"
            name="durationUnit"
            defaultValue={v.durationUnit ?? ""}
            onChange={(e) => setTyped((t) => ({ ...t, unit: e.target.value }))}
            options={WARRANTY_UNITS.map((u) => ({ value: u, label: WARRANTY_UNIT_LABELS[u].many.replace(/^./, (c) => c.toUpperCase()) }))}
            placeholder="Select unit"
            aria-invalid={errors.durationUnit ? true : undefined}
          />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={INVENTORY_PATHS.warranties} variant="secondary">
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
