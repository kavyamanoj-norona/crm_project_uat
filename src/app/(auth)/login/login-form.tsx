"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

type LoginState = {
  error?: string;
  fieldErrors?: Partial<Record<"username" | "password", string[]>>;
};

type LoginFormProps = {
  action: (prev: LoginState, formData: FormData) => Promise<LoginState>;
};

const inputCls =
  "h-11 w-full rounded-lg border border-transparent bg-primary-soft pr-3 pl-10 text-sm outline-none placeholder:text-text-muted focus:border-primary";

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <label htmlFor="username" className="mb-1.5 block text-sm font-medium">
          Username or Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <input id="username" name="username" autoComplete="username" required className={inputCls} />
        </div>
        {state.fieldErrors?.username && <p className="mt-1 text-xs text-danger">{state.fieldErrors.username[0]}</p>}
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-muted" />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className={`${inputCls} pr-10`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-text-muted hover:text-text"
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {state.fieldErrors?.password && <p className="mt-1 text-xs text-danger">{state.fieldErrors.password[0]}</p>}
      </div>

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="remember" className="size-4 accent-(--primary)" />
          Remember me
        </label>
        <span className="text-primary">Forgot password?</span>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Sign in
      </button>
    </form>
  );
}
