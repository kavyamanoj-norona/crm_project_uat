"use client";

import { useState } from "react";
import Link from "next/link";
import { KeyRound, Pencil, Power, PowerOff } from "lucide-react";
import { ActionButton } from "@/components/ui/action-button";
import type { ActionResult } from "@/lib/form";
import { ApprovedModulesModal } from "./approved-modules-modal";

type Props = {
  privilegeId: string;
  privilegeName: string;
  isSuperAdmin: boolean;
  editHref?: string;
  toggle?: () => Promise<ActionResult>;
  active: boolean;
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
  toggle,
  active,
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

        {/* Activate / Deactivate */}
        {toggle && (
          <ActionButton action={toggle} label={active ? "Deactivate" : "Activate"} className={iconBtn}>
            {active ? <PowerOff className="size-4 text-danger" /> : <Power className="size-4 text-success" />}
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
