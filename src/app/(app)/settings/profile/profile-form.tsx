"use client";

import { useActionState } from "react";
import { User } from "lucide-react";
import { useFormFeedback } from "@/hooks/use-form-feedback";
import { validateForm, initialFormState, type FormState } from "@/lib/form";
import { z } from "zod";

const schema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().optional(),
  email: z.string().email(),
});

export type ProfileInitial = {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  userCode: string;
};

type Props = {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: ProfileInitial;
};

function inputCls(error?: string | string[]) {
  return `w-full rounded-lg border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 ${error ? "border-danger" : "border-border"}`;
}

export function ProfileForm({ action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const { errors, onSubmit, onChange } = useFormFeedback({
    state,
    validate: (fd) => validateForm(schema, fd, ["firstName", "lastName", "email"]),
  });

  const v = state.values ?? {
    firstName: initial.firstName,
    lastName: initial.lastName,
    email: initial.email,
  };

  return (
    <form action={formAction} onSubmit={onSubmit} onChange={onChange} noValidate className="space-y-5">
      {state.ok && state.message && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-400">
          ✓ {state.message}
        </div>
      )}
      {state.ok === false && state.message && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Avatar */}
      <div>
        <p className="mb-2 text-sm font-medium">Image</p>
        <div className="flex items-center gap-4">
          <div className="flex size-20 items-center justify-center rounded-full bg-surface-muted">
            <User className="size-10 text-text-muted" />
          </div>
          <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
            Upload photo
          </button>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Username</label>
          <input value={initial.username} disabled className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted" />
          <p className="mt-1 text-xs text-text-muted">Username cannot be changed.</p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Employee code</label>
          <input value={initial.userCode} disabled className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted" />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="firstName">
            First Name <span className="text-danger">*</span>
          </label>
          <input id="firstName" name="firstName" defaultValue={String(v.firstName ?? "")} className={inputCls(errors.firstName)} />
          {errors.firstName && <p className="mt-1 text-xs text-danger">{errors.firstName[0]}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="lastName">Last Name</label>
          <input id="lastName" name="lastName" defaultValue={String(v.lastName ?? "")} className={inputCls()} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="email">
            Email <span className="text-danger">*</span>
          </label>
          <input id="email" name="email" type="email" defaultValue={String(v.email ?? "")} className={inputCls(errors.email)} />
          {errors.email && <p className="mt-1 text-xs text-danger">{errors.email[0]}</p>}
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Mobile</label>
          <input value={initial.mobile} disabled className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-text-muted" />
          <p className="mt-1 text-xs text-text-muted">Contact admin to change mobile.</p>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-border pt-4">
        <button type="reset" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          Cancel
        </button>
        <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
          {pending ? "Saving…" : "Update profile"}
        </button>
      </div>
    </form>
  );
}
