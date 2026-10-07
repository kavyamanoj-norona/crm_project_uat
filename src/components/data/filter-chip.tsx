"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";

export type ChipOption = { value: string; label: string };

// ── Chip button ───────────────────────────────────────────────────────────────

export function ChipBtn({
  icon: Icon,
  label,
  valueLabel,
  active,
  open,
  onClick,
  onClear,
}: {
  icon?: React.ElementType;
  label: string;
  valueLabel?: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors select-none",
        active
          ? "border-primary/40 bg-primary/5 text-primary"
          : "border-border text-text hover:bg-surface-muted",
        open && !active && "bg-surface-muted",
      )}
    >
      {Icon && <Icon className="size-3.5 shrink-0" />}
      <span>{label}</span>
      {active && valueLabel ? (
        <>
          <span className="h-4 w-px bg-primary/30" />
          <span className="max-w-40 truncate text-xs font-semibold">{valueLabel}</span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onClear(); } }}
            className="ml-0.5 rounded p-0.5 hover:bg-primary/15"
          >
            <X className="size-3" />
          </span>
        </>
      ) : (
        <ChevronDown
          className={cn("size-3.5 text-text-muted transition-transform", open && "rotate-180")}
        />
      )}
    </button>
  );
}

// ── Popover ───────────────────────────────────────────────────────────────────

export function ChipPopover({
  open,
  onToggle,
  trigger,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

// ── SelectChip ────────────────────────────────────────────────────────────────
// Controlled chip with a searchable options popover.
// onChange is called with the selected value, or "" to clear.
// Pass searchable={false} for short option lists (≤5 items).

export function SelectChip({
  label,
  icon,
  options,
  value,
  onChange,
  searchable = true,
}: {
  label: string;
  icon?: React.ElementType;
  options: ChipOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered =
    searchable && query.trim()
      ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : options;

  function select(v: string) {
    onChange(v);
    setOpen(false);
    setQuery("");
  }

  function toggle() {
    setOpen((o) => {
      if (!o && searchable) setTimeout(() => inputRef.current?.focus(), 10);
      return !o;
    });
    setQuery("");
  }

  return (
    <ChipPopover
      open={open}
      onToggle={toggle}
      trigger={
        <ChipBtn
          icon={icon}
          label={label}
          valueLabel={selected?.label}
          active={!!value}
          open={open}
          onClick={toggle}
          onClear={() => onChange("")}
        />
      }
    >
      {searchable && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-3 py-2">
          <Search className="size-3.5 shrink-0 text-text-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={label}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </div>
      )}
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">Nothing found</p>
        ) : (
          filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => select(o.value)}
              className={cn(
                "flex w-full items-center justify-between px-4 py-2 text-sm hover:bg-surface-muted",
                value === o.value && "text-primary",
              )}
            >
              <span>{o.label}</span>
              {value === o.value && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          ))
        )}
      </div>
      {value && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="flex w-full items-center justify-center py-2 text-xs text-text-muted hover:bg-surface-muted hover:text-text"
          >
            Clear filter
          </button>
        </div>
      )}
    </ChipPopover>
  );
}

// ── UrlSelectChip ─────────────────────────────────────────────────────────────
// URL-bound variant — updates a query param via router.replace + listHref.
// Use this in server-rendered pages where filters live in the URL.

export function UrlSelectChip({
  label,
  icon,
  options,
  value,
  param,
  list,
  searchable,
}: {
  label: string;
  icon?: React.ElementType;
  options: ChipOption[];
  value: string;
  param: string;
  list: Pick<ListState, "path" | "query" | "prefix">;
  searchable?: boolean;
}) {
  const router = useRouter();
  return (
    <SelectChip
      label={label}
      icon={icon}
      options={options}
      value={value}
      searchable={searchable}
      onChange={(v) =>
        router.replace(listHref(list, { [param]: v || null }), { scroll: false })
      }
    />
  );
}
