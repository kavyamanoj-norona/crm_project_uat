"use client";

import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button, LinkButton } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/field";
import { FORM_SCHEMAS, type FormSchemaKey } from "../form-schemas";

export type FieldConfig = {
  name: string;
  label: string;
  type?: "text" | "email" | "number" | "textarea" | "select" | "switch";
  required?: boolean;
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  /** Text inputs: values offered while typing (still free text). */
  suggestions?: string[];
  /** Grid columns to span on large screens (of 4). */
  span?: 1 | 2 | 3 | 4;
  /** Only show (and submit) this field while another field has the given value. */
  showWhen?: { field: string; value: string };
};

type EntityFormProps = {
  fields: FieldConfig[];
  /** Schema checked in the browser before anything is sent to the server. */
  schema: FormSchemaKey;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Record being edited, or defaults for a new one. Only `fields` are read. */
  initial?: Record<string, unknown>;
  /** Present when editing: sent as the hidden `id` field. */
  id?: string;
  cancelHref?: string;
  submitLabel?: string;
  /** Fixed values sent as hidden inputs, e.g. a parent id. */
  hidden?: Record<string, string>;
};

const spans = { 1: "lg:col-span-1", 2: "lg:col-span-2", 3: "lg:col-span-3", 4: "lg:col-span-4" };

/** Config-driven create/edit form used by the simple Master Settings screens. */
export function EntityForm({ fields, schema, action, initial = {}, id, cancelHref, submitLabel, hidden }: EntityFormProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(FORM_SCHEMAS[schema], fd),
  });
  // Values of fields that other fields depend on (showWhen), as the user changes them.
  const [watched, setWatched] = useState<Record<string, string>>({});
  const current = (name: string) => watched[name] ?? String(state.values?.[name] ?? initial[name] ?? "");

  return (
    // Remount when switching records or after a failed submit so inputs show
    // the right defaults (React resets uncontrolled forms after an action).
    <form key={`${id ?? "new"}-${JSON.stringify(state.values ?? {})}`} action={formAction}
      onSubmit={onSubmit}
      onChange={(e) => {
        onChange(e);
        const t = e.target as unknown as HTMLInputElement;
        if (t.name) setWatched((w) => ({ ...w, [t.name]: t.value }));
      }}
      className="space-y-4"
      noValidate
    >
      {id && <input type="hidden" name="id" value={id} />}
      {hidden &&
        Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.filter((f) => !f.showWhen || current(f.showWhen.field) === f.showWhen.value).map((f) => {
          const error = errors[f.name];
          const echoed = state.values;
          const value: unknown = echoed
            ? f.type === "switch"
              ? echoed[f.name] === "on"
              : echoed[f.name]
            : initial[f.name];
          const common = {
            id: f.name,
            name: f.name,
            required: f.required,
            placeholder: f.placeholder,
            "aria-invalid": error ? true : undefined,
          };

          if (f.type === "switch") {
            return (
              <div key={f.name} className={cn("flex items-end pb-2", spans[f.span ?? 1])}>
                <Switch id={f.name} name={f.name} label={f.label} defaultChecked={Boolean(value ?? false)} />
              </div>
            );
          }

          return (
            <Field
              key={f.name}
              label={f.label}
              htmlFor={f.name}
              required={f.required}
              error={error}
              hint={f.hint}
              className={spans[f.span ?? 1]}
            >
              {f.type === "textarea" ? (
                <Textarea {...common} defaultValue={value == null ? "" : String(value)} />
              ) : f.type === "select" ? (
                <Select {...common} options={f.options ?? []} defaultValue={value == null ? "" : String(value)} />
              ) : (
                <>
                  <Input
                    {...common}
                    type={f.type ?? "text"}
                    defaultValue={value == null ? "" : String(value)}
                    list={f.suggestions?.length ? `${f.name}-suggestions` : undefined}
                  />
                  {f.suggestions?.length ? (
                    <datalist id={`${f.name}-suggestions`}>
                      {f.suggestions.map((o) => (
                        <option key={o} value={o} />
                      ))}
                    </datalist>
                  ) : null}
                </>
              )}
            </Field>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {submitLabel ?? (id ? "Update" : "Submit")}
        </Button>
        {cancelHref ? (
          <LinkButton href={cancelHref} variant="secondary">
            Cancel
          </LinkButton>
        ) : (
          <Button type="reset" variant="secondary">
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
