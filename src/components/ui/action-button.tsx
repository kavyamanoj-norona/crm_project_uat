"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/form";
import { toast } from "@/components/feedback/toast";

type ActionButtonProps = {
  /** Server action already bound to its arguments. */
  action: () => Promise<ActionResult | void>;
  label: string;
  className?: string;
  role?: "switch";
  checked?: boolean;
  children: React.ReactNode;
};

/** One-click server action (toggle, lock …) with a spinner and a result toast. */
export function ActionButton({ action, label, className, role, checked, children }: ActionButtonProps) {
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      try {
        const result = await action();
        if (result) {
          if (result.ok) toast.success(result.message);
          else toast.error(result.message);
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });

  return (
    <button
      type="button"
      onClick={run}
      disabled={pending}
      role={role}
      aria-checked={role === "switch" ? checked : undefined}
      aria-label={label}
      title={label}
      className={cn("relative align-middle disabled:opacity-60", className)}
    >
      <span className={cn(pending && "invisible")}>{children}</span>
      {pending && <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-text-muted" />}
    </button>
  );
}
