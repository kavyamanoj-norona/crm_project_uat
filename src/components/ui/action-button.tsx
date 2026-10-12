"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/feedback/toast";

type ActionButtonProps = {
  /** Server action already bound to its arguments. */
  action: () => Promise<ActionResult | void>;
  label: string;
  /** Ask the user to confirm first (used for deletes). */
  confirm?: string;
  className?: string;
  role?: "switch";
  checked?: boolean;
  children: React.ReactNode;
};

/** One-click server action (toggle, lock …) with a spinner and a result toast. */
export function ActionButton({
  action,
  label,
  confirm,
  className,
  role,
  checked,
  children,
}: ActionButtonProps) {
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);

  const run = () => {
    setAsking(false);
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
  };

  return (
    <>
      <button
        type="button"
        onClick={confirm ? () => setAsking(true) : run}
        disabled={pending}
        role={role}
        aria-checked={role === "switch" ? checked : undefined}
        aria-label={label}
        title={label}
        className={cn("relative align-middle disabled:opacity-60", className)}
      >
        <span className={cn(pending && "invisible")}>{children}</span>
        {pending && (
          <Loader2 className="absolute inset-0 m-auto size-4 animate-spin text-text-muted" />
        )}
      </button>
      {confirm && (
        <ConfirmDialog
          open={asking}
          message={confirm}
          onConfirm={run}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}
