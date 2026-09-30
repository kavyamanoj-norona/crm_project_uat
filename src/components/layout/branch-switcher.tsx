"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Loader2, Lock, Search, Store } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/hooks/use-dismiss";
import { toast } from "@/components/feedback/toast";
import type { BranchChoice, SetBranchAction } from "./types";

type BranchSwitcherProps = {
  canSwitch: boolean;
  current: BranchChoice | null;
  options: BranchChoice[];
  setBranch: SetBranchAction;
};

const pill =
  "inline-flex h-9 max-w-52 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-sm transition-colors";

/**
 * Header branch picker. Admin / all-branch users choose "All branches" or one
 * branch; branch-bound users see a fixed chip with their own branch.
 */
export function BranchSwitcher({ canSwitch, current, options, setBranch }: BranchSwitcherProps) {
  const { open, setOpen, ref } = useDismiss();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState("");

  const label = current ? current.name : "All branches";

  if (!canSwitch) {
    return (
      <span className={cn(pill, "bg-surface-muted text-text")} title="Your account is limited to this branch">
        <Store className="size-4 shrink-0 text-primary" />
        <span className="hidden truncate sm:inline">{current ? `${current.name} (${current.code})` : "No branch"}</span>
        <span className="sm:hidden">{current?.code ?? "—"}</span>
        <Lock className="size-3 shrink-0 text-text-muted" aria-label="Fixed" />
      </span>
    );
  }

  const choose = (id: string | null) => {
    setOpen(false);
    setFilter("");
    const name = id ? options.find((b) => b.id === id)?.name : "all branches";
    startTransition(async () => {
      await setBranch(id);
      toast.info(`Showing data for ${name}.`, { title: "Branch changed" });
    });
  };

  const shown = options.filter((b) => `${b.name} ${b.code}`.toLowerCase().includes(filter.trim().toLowerCase()));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Branch: ${label}`}
        className={cn(pill, "hover:border-primary", current && "border-primary/40 bg-primary-soft text-primary")}
      >
        {pending ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Store className="size-4 shrink-0" />}
        <span className="hidden truncate sm:inline">{label}</span>
        <span className="sm:hidden">{current?.code ?? "All"}</span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-surface p-2 shadow-lg sm:left-0 sm:right-auto">
          {options.length > 6 && (
            <label className="relative mb-2 block">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-muted" />
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Find branch…"
                className="h-9 w-full rounded-lg border border-border bg-surface-muted pr-2 pl-8 text-sm outline-none focus:border-primary"
              />
            </label>
          )}
          <ul role="listbox" aria-label="Branches" className="max-h-72 overflow-y-auto">
            <Option selected={!current} onClick={() => choose(null)}>
              All branches
            </Option>
            {shown.map((b) => (
              <Option key={b.id} selected={current?.id === b.id} onClick={() => choose(b.id)}>
                {b.name}
                <span className="ml-auto text-xs text-text-muted">{b.code}</span>
              </Option>
            ))}
            {shown.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">No branch matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Option({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-muted",
          selected && "bg-primary-soft font-medium text-primary hover:bg-primary-soft",
        )}
      >
        <Check className={cn("size-4 shrink-0", !selected && "invisible")} />
        {children}
      </button>
    </li>
  );
}
