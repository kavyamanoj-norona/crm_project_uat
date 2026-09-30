import Link from "next/link";
import { Pencil, Power, PowerOff } from "lucide-react";
import type { ActionResult } from "@/lib/form";
import { ActionButton } from "@/components/ui/action-button";

type RowActionsProps = {
  editHref?: string;
  /** Server action already bound to the row id. */
  toggle?: () => Promise<ActionResult>;
  active?: boolean;
  children?: React.ReactNode;
};

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text";

/** Edit link + activate/deactivate button (with toast). There are no hard deletes. */
export function RowActions({ editHref, toggle, active, children }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {children}
      {editHref && (
        <Link href={editHref} className={iconBtn} aria-label="Edit" title="Edit">
          <Pencil className="size-4" />
        </Link>
      )}
      {toggle && (
        <ActionButton action={toggle} label={active ? "Deactivate" : "Activate"} className={iconBtn}>
          {active ? <PowerOff className="size-4 text-danger" /> : <Power className="size-4 text-success" />}
        </ActionButton>
      )}
    </div>
  );
}
