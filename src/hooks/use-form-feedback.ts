"use client";

import { useEffect, useState } from "react";
import type { FormState } from "@/lib/form";
import { toast } from "@/components/feedback/toast";

type FieldErrors = Record<string, string[] | undefined>;

type Options = {
  /** Server action state from useActionState. */
  state: FormState;
  /** Client-side check run before submitting; return field errors or null. */
  validate?: (formData: FormData) => FieldErrors | null;
};

/**
 * Form feedback in one place:
 * - validates in the browser first; invalid → no request, errors under the
 *   inputs and an error toast
 * - server results (duplicate username, no permission …) → toast + field errors
 * - editing a field clears its error
 *
 * Wire it as `onSubmit` + `onChange` on the <form>. Use onChange, not onInput:
 * a re-render on the raw `input` event resets controlled <select>s before
 * their own onChange runs, so the picked option is lost.
 */
export function useFormFeedback({ state, validate }: Options) {
  // Client errors are tied to the server state they were raised against, so a
  // new server response automatically takes over without an effect.
  const [client, setClient] = useState<{ errors: FieldErrors; for: FormState } | null>(null);
  const [cleared, setCleared] = useState<{ names: Set<string>; for: FormState }>({ names: new Set(), for: state });

  useEffect(() => {
    if (!state.message) return;
    if (state.ok) toast.success(state.message);
    else toast.error(state.message);
  }, [state]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const errors = validate?.(new FormData(e.currentTarget));
    const entries = Object.entries(errors ?? {}).filter(([, v]) => v?.length);
    if (entries.length === 0) {
      setClient(null);
      return; // let the action run
    }
    e.preventDefault();
    setClient({ errors: Object.fromEntries(entries), for: state });
    setCleared({ names: new Set(), for: state });
    const first = entries[0]![1]![0]!;
    toast.error(entries.length === 1 ? first : `${first} (and ${entries.length - 1} more)`, {
      title: "Please check the form",
    });
    // focus the first invalid field
    const el = e.currentTarget.elements.namedItem(entries[0]![0]);
    if (el instanceof HTMLElement) el.focus();
  };

  const onChange = (e: React.FormEvent<HTMLFormElement>) => {
    const name = (e.target as HTMLInputElement).name;
    if (!name) return;
    setCleared((c) => ({ names: new Set(c.for === state ? c.names : []).add(name), for: state }));
  };

  const source = client && client.for === state ? client.errors : (state.fieldErrors ?? {});
  const hidden = cleared.for === state ? cleared.names : new Set<string>();
  const errors: FieldErrors = Object.fromEntries(Object.entries(source).filter(([k]) => !hidden.has(k)));

  return { errors, onSubmit, onChange };
}
