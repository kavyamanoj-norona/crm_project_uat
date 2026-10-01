"use client";

import { useActionState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { ModalButton } from "@/components/ui/modal-button";

type Errors = Record<string, string[] | undefined>;

type ActionDialogProps = {
  /** Content of the button that opens the dialog. */
  trigger: React.ReactNode;
  triggerVariant?: "primary" | "navy" | "secondary" | "danger" | "ghost";
  title: string;
  description?: string;
  /** Server action (already bound to its record). Closes the dialog when it returns ok. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Browser-side check before submitting (same schema as the server). */
  validate?: (formData: FormData) => Errors | null;
  submitLabel: string;
  submitVariant?: "primary" | "danger";
  /** The fields; receives the current field errors. */
  children: (errors: Errors) => React.ReactNode;
};

/** A button that opens a small form in a modal — for actions that need a note or a choice. */
export function ActionDialog({ trigger, triggerVariant = "secondary", title, description, ...form }: ActionDialogProps) {
  return (
    <ModalButton trigger={trigger} variant={triggerVariant} title={title} description={description}>
      {(close) => <DialogForm {...form} onDone={close} />}
    </ModalButton>
  );
}

function DialogForm({
  action,
  validate,
  submitLabel,
  submitVariant = "primary",
  children,
  onDone,
}: Omit<ActionDialogProps, "trigger" | "triggerVariant" | "title" | "description"> & { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({ state, validate });

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      {children(errors)}
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          Close
        </Button>
        <Button type="submit" variant={submitVariant} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
