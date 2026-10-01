"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "@/components/feedback/toast";

export type RevealResult = { ok: true; value: string } | { ok: false; message: string };

type SecretRevealProps = {
  /** Server action bound to the record; it should log every reveal. */
  reveal: () => Promise<RevealResult>;
  label?: string;
};

/** Masked value with a Reveal button. The value is only fetched when asked for. */
export function SecretReveal({ reveal, label = "Reveal" }: SecretRevealProps) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      try {
        const r = await reveal();
        if (r.ok) setValue(r.value);
        else toast.error(r.message);
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  return (
    <span className="inline-flex items-center gap-2">
      <code className="rounded bg-surface-muted px-2 py-0.5 text-sm">{value ?? "••••••"}</code>
      {value === null ? (
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline disabled:opacity-60"
        >
          {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setValue(null)}
          className="inline-flex items-center gap-1 text-xs font-medium text-text-muted hover:text-text"
        >
          <EyeOff className="size-3.5" /> Hide
        </button>
      )}
    </span>
  );
}
