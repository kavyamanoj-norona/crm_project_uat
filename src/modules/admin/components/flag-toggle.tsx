import { cn } from "@/lib/cn";

type FlagToggleProps = {
  on: boolean;
  label: string;
  /** Server action bound to the row; omit to render read-only. */
  action?: () => Promise<void>;
  children?: React.ReactNode;
};

/** A switch in a table cell that submits a bound server action. */
export function FlagToggle({ on, label, action, children }: FlagToggleProps) {
  const visual = children ?? (
    <span
      className={cn(
        "relative inline-block h-5 w-9 rounded-full transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform",
        on ? "bg-primary after:translate-x-4" : "bg-border",
      )}
    />
  );

  if (!action) return <span aria-label={`${label}: ${on ? "on" : "off"}`}>{visual}</span>;

  return (
    <form action={action}>
      <button type="submit" role="switch" aria-checked={on} aria-label={label} title={label} className="align-middle">
        {visual}
      </button>
    </form>
  );
}
