"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { NavIcon } from "@/components/ui/nav-icon";
import { cn } from "@/lib/cn";
import { updateSinglePermission } from "../actions/permissions";

const FLAGS = [
  { key: "canView" as const, label: "View" },
  { key: "canCreate" as const, label: "Create" },
  { key: "canEdit" as const, label: "Edit" },
  { key: "canDelete" as const, label: "Delete" },
  { key: "canApprove" as const, label: "Approve" },
];

type Flag = (typeof FLAGS)[number]["key"];

export type MatrixItem = {
  id: string;
  title: string;
  path: string;
  groupTitle?: string;
  flags: Record<Flag, boolean>;
};

export type MatrixModule = {
  id: string;
  title: string;
  icon: string;
  isActive: boolean;
  items: MatrixItem[];
};

type PermMap = Record<string, Record<Flag, boolean>>;

function buildPermMap(modules: MatrixModule[]): PermMap {
  const m: PermMap = {};
  for (const mod of modules) {
    for (const item of mod.items) {
      m[item.id] = { ...item.flags };
    }
  }
  return m;
}

type Props = {
  modules: MatrixModule[];
  privilegeId: string;
  readOnly: boolean;
  privilegeName: string;
  allModules: { id: string; title: string }[];
  selectedModuleId?: string;
  showSelectorBar?: boolean;
};

export function PermissionMatrix({
  modules,
  privilegeId,
  readOnly,
  privilegeName,
  allModules,
  selectedModuleId,
  showSelectorBar = true,
}: Props) {
  const [perms, setPerms] = useState<PermMap>(() => buildPermMap(modules));
  const [, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();

  const displayedModules = selectedModuleId
    ? modules.filter((m) => m.id === selectedModuleId)
    : modules;

  const handleModuleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    router.push(val ? `${pathname}?module=${val}` : pathname);
  };

  /** Update one flag — optimistic + immediate server save. */
  function setFlag(menuId: string, flag: Flag, next: boolean) {
    if (readOnly) return;

    const current = perms[menuId]!;
    const newItem = { ...current, [flag]: next };
    const saves: [Flag, boolean][] = [[flag, next]];

    // Enabling any non-view flag → view must also be true
    if (next && flag !== "canView" && !current.canView) {
      newItem.canView = true;
      saves.push(["canView", true]);
    }
    // Disabling view → clear all other flags
    if (!next && flag === "canView") {
      for (const f of FLAGS) {
        if (f.key !== "canView") {
          newItem[f.key] = false;
          saves.push([f.key, false]);
        }
      }
    }

    setPerms((prev) => ({ ...prev, [menuId]: newItem }));
    startTransition(async () => {
      await Promise.all(saves.map(([f, v]) => updateSinglePermission(privilegeId, menuId, f, v)));
    });
  }

  /** Toggle all flags for one item row. */
  function toggleItemAll(menuId: string) {
    if (readOnly) return;
    const current = perms[menuId]!;
    const allOn = FLAGS.every((f) => current[f.key]);
    const next = !allOn;
    const newItem = Object.fromEntries(FLAGS.map((f) => [f.key, next])) as Record<Flag, boolean>;
    setPerms((prev) => ({ ...prev, [menuId]: newItem }));
    startTransition(async () => {
      await Promise.all(FLAGS.map((f) => updateSinglePermission(privilegeId, menuId, f.key, next)));
    });
  }

  /** Toggle all flags for every item in a module. */
  function toggleModuleAll(moduleId: string) {
    if (readOnly) return;
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod) return;
    const allOn = mod.items.every((item) => FLAGS.every((f) => perms[item.id]?.[f.key]));
    const next = !allOn;
    setPerms((prev) => {
      const updated = { ...prev };
      for (const item of mod.items) {
        updated[item.id] = Object.fromEntries(FLAGS.map((f) => [f.key, next])) as Record<Flag, boolean>;
      }
      return updated;
    });
    startTransition(async () => {
      await Promise.all(
        mod.items.flatMap((item) =>
          FLAGS.map((f) => updateSinglePermission(privilegeId, item.id, f.key, next)),
        ),
      );
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Built-in selector bar (privileges/[id] page only) ── */}
      {showSelectorBar && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5">
            <ShieldCheck className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-text-muted">Privilege</span>
            <span className="ml-1 text-xs font-semibold text-text">{privilegeName}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-3 py-1.5">
            <span className="text-xs font-medium text-text-muted">Module</span>
            <select
              value={selectedModuleId ?? ""}
              onChange={handleModuleChange}
              className="ml-1 cursor-pointer bg-transparent text-xs font-semibold text-text outline-none"
            >
              <option value="">All modules</option>
              {allModules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          {selectedModuleId && (
            <button
              type="button"
              onClick={() => router.push(pathname)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:border-primary hover:text-primary"
            >
              Reset
            </button>
          )}

          <span className="ml-auto text-xs text-text-muted">
            {displayedModules.reduce((n, m) => n + m.items.length, 0)} menu items
          </span>
        </div>
      )}

      {/* ── Permission table ── */}
      <div className="overflow-x-auto rounded-xl border border-border shadow-sm">
        <table className="w-full min-w-[700px] table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-28" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-20" />
          </colgroup>
          <thead className="bg-surface-muted text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Menu</th>
              <th className="px-2 py-3 text-center text-primary">Full Access</th>
              {FLAGS.map((f) => (
                <th key={f.key} className="px-2 py-3 text-center">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>

          {displayedModules.map((mod) => {
            const allModOn = mod.items.length > 0 && mod.items.every((item) => FLAGS.every((f) => perms[item.id]?.[f.key]));
            return (
              <tbody key={mod.id} className="border-t border-border">
                {/* Module header */}
                <tr className="bg-primary/5">
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2 font-semibold text-text">
                      <NavIcon name={mod.icon} className="size-4 shrink-0 text-primary" />
                      <span className="truncate">{mod.title}</span>
                      {!mod.isActive && (
                        <span className="shrink-0 text-xs font-normal text-text-muted">(inactive)</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center">
                    {!readOnly && mod.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleModuleAll(mod.id)}
                        className="rounded-md px-2 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                      >
                        {allModOn ? "Clear all" : "Toggle all"}
                      </button>
                    )}
                  </td>
                  {FLAGS.map((f) => (
                    <td key={f.key} />
                  ))}
                </tr>

                {/* Item rows */}
                {mod.items.map((item) => {
                  const p = perms[item.id]!;
                  const allItemOn = FLAGS.every((f) => p[f.key]);
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-border/50 transition-colors hover:bg-surface-muted/40"
                    >
                      <td className="px-4 py-2.5 pl-10">
                        <span className="block truncate font-medium text-text">{item.title}</span>
                        <span className="block truncate text-[11px] text-text-muted">
                          {item.groupTitle ? `${item.groupTitle} · ` : ""}
                          <code className="font-mono">{item.path}</code>
                        </span>
                      </td>

                      {/* Full-access toggle */}
                      <td className="px-2 py-2.5 text-center">
                        {readOnly ? (
                          <span
                            className={cn(
                              "text-sm",
                              allItemOn ? "text-primary" : "text-text-muted/30",
                            )}
                          >
                            ✓
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => toggleItemAll(item.id)}
                            className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10"
                          >
                            {allItemOn ? "clear" : "all"}
                          </button>
                        )}
                      </td>

                      {FLAGS.map((f) => (
                        <td key={f.key} className="px-2 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={p[f.key]}
                            onChange={(e) => setFlag(item.id, f.key, e.target.checked)}
                            disabled={readOnly}
                            aria-label={`${item.title}: ${f.label}`}
                            className="size-4 cursor-pointer accent-(--primary) disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}

          {displayedModules.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-text-muted">
                  No menus found for this selection.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
