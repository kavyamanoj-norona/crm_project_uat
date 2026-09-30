"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { initialFormState, validateForm, type FormState } from "@/lib/form";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Modal } from "@/components/ui/modal";
import { PASSWORD_MIN, passwordChangeSchema } from "../user-schema";

type PasswordDialogProps = {
  userName: string;
  /** changeUserPassword bound to the user id. */
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  className?: string;
};

/** Key button in the Users table → dialog to set a new password. */
export function PasswordDialog({ userName, action, className }: PasswordDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-label="Change password" title="Change password">
        <KeyRound className="size-4" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Change password"
        description={`Set a new password for ${userName}. It also clears any sign-in lockout.`}
      >
        {/* remount per opening so the form starts empty */}
        {open && <PasswordForm action={action} onDone={() => setOpen(false)} />}
      </Modal>
    </>
  );
}

function PasswordForm({ action, onDone }: { action: PasswordDialogProps["action"]; onDone: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(passwordChangeSchema, fd),
  });

  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-4">
      <Field label="New password" htmlFor="password" required error={errors.password} hint={`At least ${PASSWORD_MIN} characters`}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          aria-invalid={errors.password ? true : undefined}
        />
      </Field>
      <Field label="Confirm password" htmlFor="confirmPassword" required error={errors.confirmPassword}>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          aria-invalid={errors.confirmPassword ? true : undefined}
        />
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Update password
        </Button>
      </div>
    </form>
  );
}
