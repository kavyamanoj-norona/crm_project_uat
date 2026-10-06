"use client";

import { useState, useEffect, useTransition } from "react";
import { Layers } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/cn";
import { getModulesForPrivilege, toggleModuleAccess } from "../actions/module-access";

type ModuleRow = { id: string; title: string; hasAccess: boolean };

type Props = {
  privilegeId: string;
  privilegeName: string;
  isSuperAdmin: boolean;
  canEdit: boolean;
  open: boolean;
  onClose: () => void;
};

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        checked ? "bg-primary" : "bg-border",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <span
        className={cn(
          "inline-block size-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}

export function ApprovedModulesModal({ privilegeId, privilegeName, isSuperAdmin, canEdit, open, onClose }: Props) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getModulesForPrivilege(privilegeId)
      .then(setModules)
      .finally(() => setLoading(false));
  }, [open, privilegeId]);

  const toggle = (moduleId: string) => {
    if (!canEdit || isSuperAdmin) return;
    const next = !modules.find((m) => m.id === moduleId)?.hasAccess;
    setModules((prev) => prev.map((m) => (m.id === moduleId ? { ...m, hasAccess: next } : m)));
    startTransition(async () => {
      await toggleModuleAccess(privilegeId, moduleId, next);
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${privilegeName} Privilege: Approved Modules`}
      icon={<Layers className="size-5" />}
      size="md"
    >
      {isSuperAdmin ? (
        <p className="text-sm text-text-muted">
          Super-admin privilege — has access to all modules automatically.
        </p>
      ) : loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-text-muted">Loading…</div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-text-muted">
              <tr>
                <th className="w-10 px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m, i) => (
                <tr key={m.id} className="border-t border-border hover:bg-surface-muted/40">
                  <td className="px-4 py-3 text-text-muted">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{m.title}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <ToggleSwitch
                        checked={m.hasAccess}
                        onChange={() => toggle(m.id)}
                        disabled={!canEdit || pending}
                      />
                    </div>
                  </td>
                </tr>
              ))}
              {modules.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-text-muted">
                    No active modules found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
