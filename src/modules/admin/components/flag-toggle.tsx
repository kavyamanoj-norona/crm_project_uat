import { cn } from "@/lib/cn";
import type { ActionResult } from "@/lib/form";
import { ActionButton } from "@/components/ui/action-button";

type FlagToggleProps = {
  on: boolean;
  label: string;
  /** Server action bound to the row; omit to render read-only. */
  action?: () => Promise<ActionResult>;
  children?: React.ReactNode;
};

/** A switch in a table cell that runs a bound server action and toasts the result. */
export function FlagToggle({ on, label, action, children }: FlagToggleProps) {
  const visual = children ?? (
    <span
      className={cn(
        "relative inline-block h-5 w-9 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform",
        on ? "bg-primary after:translate-x-4" : "bg-border",
      )}
    />
  );

  if (!action) {
    return (
      <span aria-label={`${label}: ${on ? "on" : "off"}`} className="inline-block opacity-60">
        {visual}
      </span>
    );
  }

  return (
    <ActionButton action={action} label={label} role="switch" checked={on}>
      {visual}
    </ActionButton>
  );
}
