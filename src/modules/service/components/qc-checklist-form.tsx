"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { QC_CHECKLIST_FIELDS, qcChecklistSchema } from "../qc-checklist-schema";
import { SERVICE_PATHS } from "../paths";

export type QcChecklistFormValues = Record<string, string>;

type QcChecklistFormProps = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: QcChecklistFormValues;
  id?: string;
};

export function QcChecklistForm({ action, initial, id }: QcChecklistFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(qcChecklistSchema, fd, QC_CHECKLIST_FIELDS),
  });
  const v: QcChecklistFormValues = state.values ?? initial ?? {};

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Checklist item" htmlFor="title" required error={errors.title}>
          <Input {...f("title")} placeholder="Enter checklist item" />
        </Field>
        <Field label="Description" htmlFor="description" error={errors.description}>
          <Textarea {...f("description")} placeholder="Enter description" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {id ? "Update" : "Submit"}
        </Button>
        {id ? (
          <LinkButton href={SERVICE_PATHS.qcChecklist} variant="secondary">
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
