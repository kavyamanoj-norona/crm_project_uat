"use client";

import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { initialFormState, type FormState } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/forms/form-message";
import { NavIcon } from "@/components/ui/nav-icon";

const FLAGS = [
  { key: "canView", label: "View" },
  { key: "canCreate", label: "Create" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
  { key: "canApprove", label: "Approve" },
] as const;

type Flag = (typeof FLAGS)[number]["key"];

export type MatrixItem = { id: string; title: string; path: string; groupTitle?: string; flags: Record<Flag, boolean> };
export type MatrixModule = { id: string; title: string; icon: string; isActive: boolean; items: MatrixItem[] };

type PermissionMatrixProps = {
  modules: MatrixModule[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  readOnly: boolean;
};

export function PermissionMatrix({ modules, action, readOnly }: PermissionMatrixProps) {
  const [state, formAction, pending] = useActionState(action, initialFormState);
  const formRef = useRef<HTMLFormElement>(null);

  /** Toggle one flag for every item in a module. */
  const toggleColumn = (moduleId: string, flag: Flag) => {
    const boxes = formRef.current?.querySelectorAll<HTMLInputElement>(
      `input[data-module="${moduleId}"][data-flag="${flag}"]`,
    );
    if (!boxes) return;
    const next = ![...boxes].every((b) => b.checked);
    boxes.forEach((b) => (b.checked = next));
  };

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <FormMessage ok={state.ok} message={state.message} />

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="sticky top-16 bg-surface-muted text-xs font-semibold text-text-muted uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Menu</th>
              {FLAGS.map((f) => (
                <th key={f.key} className="w-24 px-2 py-3 text-center">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          {modules.map((m) => (
            <tbody key={m.id} className="border-t border-border">
              <tr className="bg-primary-soft/50">
                <td className="px-4 py-2 font-semibold">
                  <span className="flex items-center gap-2">
                    <NavIcon name={m.icon} className="size-4 text-primary" />
                    {m.title}
                    {!m.isActive && <span className="text-xs font-normal text-text-muted">(inactive module)</span>}
                  </span>
                </td>
                {FLAGS.map((f) => (
                  <td key={f.key} className="px-2 py-2 text-center">
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => toggleColumn(m.id, f.key)}
                        className="rounded px-1.5 text-[11px] font-medium text-primary hover:underline"
                      >
                        all
                      </button>
                    )}
                  </td>
                ))}
              </tr>
              {m.items.map((item) => (
                <tr key={item.id} className="border-t border-border/60 hover:bg-surface-muted/60">
                  <td className="px-4 py-2 pl-10">
                    <input type="hidden" name="menuIds" value={item.id} />
                    <span className="text-text">{item.title}</span>
                    <span className="ml-2 text-xs text-text-muted">
                      {item.groupTitle ? `${item.groupTitle} · ` : ""}
                      {item.path}
                    </span>
                  </td>
                  {FLAGS.map((f) => (
                    <td key={f.key} className="px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        name={`p.${item.id}.${f.key}`}
                        defaultChecked={item.flags[f.key]}
                        disabled={readOnly}
                        data-module={m.id}
                        data-flag={f.key}
                        aria-label={`${item.title}: ${f.label}`}
                        className="size-4 accent-(--primary)"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>

      {!readOnly && (
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Save permissions
        </Button>
      )}
    </form>
  );
}
