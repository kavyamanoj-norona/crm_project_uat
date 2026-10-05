"use client";

import { useActionState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { initialFormState, type FormState } from "@/lib/form";
import { changePassword } from "@/server/settings/actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialFormState);
  const [showNew, setShowNew] = useState(false);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} noValidate className="space-y-4">
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

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="currentPassword">Current Password:</label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.currentPassword ? "border-danger" : "border-border"}`}
        />
        {errors.currentPassword && <p className="mt-1 text-xs text-danger">{errors.currentPassword[0]}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="newPassword">New Password:</label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNew ? "text" : "password"}
            autoComplete="new-password"
            className={`w-full rounded-lg border px-3 py-2 pr-10 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.newPassword ? "border-danger" : "border-border"}`}
          />
          <button
            type="button"
            onClick={() => setShowNew((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
          >
            {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {errors.newPassword && <p className="mt-1 text-xs text-danger">{errors.newPassword[0]}</p>}
        <p className="mt-1 text-xs text-text-muted">Minimum 8 characters.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium" htmlFor="confirmPassword">Confirm Password:</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          className={`w-full rounded-lg border px-3 py-2 text-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.confirmPassword ? "border-danger" : "border-border"}`}
        />
        {errors.confirmPassword && <p className="mt-1 text-xs text-danger">{errors.confirmPassword[0]}</p>}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="reset" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Updating…" : "Update password"}
        </button>
      </div>
    </form>
  );
}
