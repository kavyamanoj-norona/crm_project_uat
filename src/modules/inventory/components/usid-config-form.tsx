"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { USID_CONFIG_FIELDS, usidConfigSchema } from "../usid-schema";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** The USID the next unit would get, shown as the starting value. */
  current: string;
};

export function UsidConfigForm({ action, current }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(usidConfigSchema, fd, USID_CONFIG_FIELDS),
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
          label="Starting USID"
          htmlFor="startingUsid"
          required
          error={errors.startingUsid}
          hint="Letters then digits, e.g. HG0001. The digits set the number of places, so leading zeros are kept (HG0001, HG0002, …)."
        >
          <Input id="startingUsid" name="startingUsid" defaultValue={current} placeholder="Enter starting USID" aria-invalid={errors.startingUsid ? true : undefined} />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Save configuration
      </Button>
    </form>
  );
}
