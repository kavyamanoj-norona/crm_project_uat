import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import type { ActionResult } from "@/lib/form";
import { cn } from "@/lib/cn";
import { ActionButton } from "@/components/ui/action-button";

type RowActionsProps = {
  editHref?: string;
  /** Server action already bound to the row id. */
  /** Soft-delete server action already bound to the row id. */
  remove?: () => Promise<ActionResult>;
  children?: React.ReactNode;
};

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text";

/** Edit link + delete button (soft delete with confirm and toast). There are no hard deletes. */
export function RowActions({ editHref, remove, children }: RowActionsProps) {
  return (
    <div className="flex items-center gap-1">
      {children}
      {editHref && (
        <Link href={editHref} className={iconBtn} aria-label="Edit" title="Edit">
          <Pencil className="size-4" />
        </Link>
      )}
      {remove && (
        <ActionButton
          action={remove}
          label="Delete"
          confirm="Are you sure you want to delete this record?"
          className={cn(iconBtn, "hover:bg-danger/10 hover:text-danger")}
        >
          <Trash2 className="size-4" />
        </ActionButton>
      )}
    </div>
  );
}
