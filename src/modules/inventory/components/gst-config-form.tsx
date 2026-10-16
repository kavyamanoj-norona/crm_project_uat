"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { GST_CONFIG_FIELDS, gstRatesSchema } from "../usid-schema";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  current: number[];
};

export function GstConfigForm({ action, current }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(gstRatesSchema, fd, GST_CONFIG_FIELDS),
  });

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      {state.message && (
        <p className={`rounded-lg px-3 py-2 text-sm ${state.ok ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`} role={state.ok ? "status" : "alert"}>
          {state.message}
        </p>
      )}
      <div className="grid gap-4">
        <Field
          label="GST rates (%)"
          htmlFor="gstRates"
          required
          error={errors.gstRates}
          hint="Separate with commas. These are the choices in the GST % column when entering a purchase bill."
        >
          <Input id="gstRates" name="gstRates" defaultValue={current.join(", ")} placeholder="Enter GST rates" aria-invalid={errors.gstRates ? true : undefined} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Save GST rates
      </Button>
    </form>
  );
}
