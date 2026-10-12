import { Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/form";
import { cn } from "@/lib/cn";
import { ActionButton } from "@/components/ui/action-button";

/** Trash icon that runs a bound soft-delete server action after a confirmation. */
export function DeleteButton({ action, className }: { action: () => Promise<ActionResult>; className?: string }) {
  return (
    <ActionButton
      action={action}
      label="Delete"
      confirm="Are you sure you want to delete this record?"
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger/10 hover:text-danger",
        className,
      )}
    >
      <Trash2 className="size-4" />
    </ActionButton>
  );
}
