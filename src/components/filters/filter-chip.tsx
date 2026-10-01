"use client";

import { Filter } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/hooks/use-dismiss";

type FilterChipProps = {
  label: string;
  /** Current value shown in the pill; omit when nothing is picked. */
  value?: string;
  icon?: React.ReactNode;
  /** Panel opens right-aligned (for chips near the right edge). */
  align?: "left" | "right";
  panelClassName?: string;
  /** Dropdown content; call `close` after a pick. */
  children: (close: () => void) => React.ReactNode;
};

/** Dashed filter chip — "▽ Range | Today" — that opens a dropdown panel. */
export function FilterChip({ label, value, icon, align = "left", panelClassName, children }: FilterChipProps) {
  const { open, setOpen, ref } = useDismiss();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-lg border bg-surface px-3 text-sm font-medium text-text transition-colors hover:border-primary",
          open ? "border-primary" : "border-dashed border-border",
        )}
      >
        <span className="text-text-muted">{icon ?? <Filter className="size-4" />}</span>
        {label}
        {value && (
          <>
            <span aria-hidden className="h-4 w-px bg-border" />
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-xs font-semibold">{value}</span>
          </>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className={cn(
            "absolute top-full z-30 mt-2 min-w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg",
            align === "right" ? "right-0" : "left-0",
            panelClassName,
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
