"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { ActionButton } from "@/components/ui/action-button";
import type { ActionResult } from "@/lib/form";
import { ApprovedModulesModal } from "./approved-modules-modal";

type Props = {
  privilegeId: string;
  privilegeName: string;
  isSuperAdmin: boolean;
  editHref?: string;
  remove?: () => Promise<ActionResult>;
  canEdit: boolean;
  permissionsHref: string;
};

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text";

export function PrivilegeActionsCell({
  privilegeId,
  privilegeName,
  isSuperAdmin,
  editHref,
  remove,
  canEdit,
  permissionsHref,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {/* Shield → Approved Modules modal */}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className={iconBtn}
          title="Approved Modules"
          aria-label="Approved Modules"
        >
          <KeyRound className="size-4" />
        </button>

        {/* Edit */}
        {editHref && (
          <Link href={editHref} className={iconBtn} aria-label="Edit" title="Edit">
            <Pencil className="size-4" />
          </Link>
        )}

        {/* Delete (soft) */}
        {remove && (
          <ActionButton
            action={remove}
            label="Delete"
            confirm="Are you sure you want to delete this privilege?"
            className={cn(iconBtn, "hover:bg-danger/10 hover:text-danger")}
          >
            <Trash2 className="size-4" />
          </ActionButton>
        )}
      </div>

      <ApprovedModulesModal
        privilegeId={privilegeId}
        privilegeName={privilegeName}
        isSuperAdmin={isSuperAdmin}
        canEdit={canEdit}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
