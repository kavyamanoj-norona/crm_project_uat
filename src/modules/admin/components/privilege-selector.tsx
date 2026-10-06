"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { ShieldCheck, Layout, Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Opt = { id: string; name: string };

/** Reusable dropdown used for both Privilege and Module selectors. */
function SelectorDropdown({
  icon,
  label,
  options,
  selectedId,
  selectedName,
  onSelect,
  onClear,
  placeholder = "Search…",
}: {
  icon: React.ReactNode;
  label: string;
  options: Opt[];
  selectedId?: string;
  selectedName?: string;
  onSelect: (id: string) => void;
  onClear?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = options.filter(
    (o) => search === "" || o.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus:outline-none",
          selectedId
            ? "border-primary/40 bg-primary/5 text-primary"
            : "border-border bg-surface text-text-muted hover:border-primary/40 hover:text-text",
        )}
      >
        <span className="size-4 shrink-0">{icon}</span>
        <span className="text-text-muted">{label}</span>
        {selectedName && (
          <>
            <span className="mx-0.5 h-4 w-px bg-primary/20" />
            <span className="max-w-[120px] truncate font-semibold text-primary">{selectedName}</span>
            {onClear && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                onKeyDown={(e) => e.key === "Enter" && (e.stopPropagation(), onClear?.())}
                className="ml-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-primary/60 hover:bg-primary/10 hover:text-primary"
              >
                <X className="size-3" />
              </span>
            )}
          </>
        )}
        <ChevronDown
          className={cn("ml-auto size-3.5 shrink-0 text-text-muted transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+4px)] z-[100] min-w-[200px] w-max max-w-[min(260px,calc(100vw-2rem))]",
            "rounded-xl border border-border bg-surface shadow-2xl",
          )}
        >
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-3.5 shrink-0 text-text-muted" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-muted"
            />
          </div>

          {/* List */}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-text-muted">Nothing found</li>
            ) : (
              filtered.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(o.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-surface-muted",
                      o.id === selectedId && "bg-primary/5 text-primary",
                    )}
                  >
                    {/* Radio-style indicator */}
                    <span
                      className={cn(
                        "flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                        o.id === selectedId ? "border-primary" : "border-border",
                      )}
                    >
                      {o.id === selectedId && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="min-w-0 truncate">{o.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  privileges: { id: string; name: string; code: string }[];
  selectedId?: string;
  selectedPrivilegeName?: string;
  /** Pass when a privilege is selected so the Module dropdown can work */
  modules?: { id: string; title: string }[];
  selectedModuleId?: string;
};

export function PrivilegeSelector({
  privileges,
  selectedId,
  selectedPrivilegeName,
  modules,
  selectedModuleId,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const selectPrivilege = useCallback(
    (id: string) => {
      // Clear module when switching privilege
      router.push(`${pathname}?privilege=${id}`);
    },
    [router, pathname],
  );

  const clearPrivilege = useCallback(() => {
    router.push(pathname);
  }, [router, pathname]);

  const selectModule = useCallback(
    (id: string) => {
      router.push(`${pathname}?privilege=${selectedId}&module=${id}`);
    },
    [router, pathname, selectedId],
  );

  const clearModule = useCallback(() => {
    router.push(`${pathname}?privilege=${selectedId}`);
  }, [router, pathname, selectedId]);

  const reset = useCallback(() => router.push(pathname), [router, pathname]);

  const selectedModule = modules?.find((m) => m.id === selectedModuleId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Privilege */}
      <SelectorDropdown
        icon={<ShieldCheck className="size-4" />}
        label="Privilege"
        options={privileges.map((p) => ({ id: p.id, name: p.name }))}
        selectedId={selectedId}
        selectedName={selectedPrivilegeName}
        onSelect={selectPrivilege}
        onClear={selectedId ? clearPrivilege : undefined}
        placeholder="Search privilege…"
      />

      {/* Module — only shown after a privilege is chosen */}
      {selectedId && modules && modules.length > 0 && (
        <SelectorDropdown
          icon={<Layout className="size-4" />}
          label="Module"
          options={modules.map((m) => ({ id: m.id, name: m.title }))}
          selectedId={selectedModuleId}
          selectedName={selectedModule?.title}
          onSelect={selectModule}
          onClear={selectedModuleId ? clearModule : undefined}
          placeholder="Search module…"
        />
      )}

      {/* Reset — clears both selections */}
      {selectedId && (
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:border-danger/40 hover:text-danger"
        >
          Reset
        </button>
      )}
    </div>
  );
}
