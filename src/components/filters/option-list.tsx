"use client";

import { useState } from "react";
import { Check, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type FilterOption = { value: string; label: string; disabled?: boolean };

type OptionListProps = {
  options: FilterOption[];
  selected?: string;
  onSelect: (value: string) => void;
  /** Shows the "Clear Filter" footer. */
  onClear?: () => void;
  /** Search box placeholder; the box shows when there are more than 5 options or this is set. */
  searchPlaceholder?: string;
};

/** Searchable single-pick list with check boxes and a "Clear Filter" footer, for FilterChip panels. */
export function OptionList({ options, selected, onSelect, onClear, searchPlaceholder }: OptionListProps) {
  const [q, setQ] = useState("");
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())) : options;
  const searchable = searchPlaceholder !== undefined || options.length > 5;

  return (
    <div>
      {searchable && (
        <label className="flex items-center gap-2 border-b border-border bg-surface-muted px-3">
          <Search className="size-4 text-primary" />
          <span className="sr-only">Search</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder ?? "Search"}
            autoFocus
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
          />
        </label>
      )}
      <ul role="listbox" aria-label="Options" className="max-h-72 overflow-y-auto py-1">
        {shown.length === 0 && <li className="px-4 py-3 text-sm text-text-muted">No match</li>}
        {shown.map((o) => {
          const on = o.value === selected;
          return (
            <li key={o.value} role="option" aria-selected={on} aria-disabled={o.disabled}>
              <button
                type="button"
                disabled={o.disabled}
                onClick={() => onSelect(o.value)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded border",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface",
                  )}
                >
                  {on && <Check className="size-3.5 stroke-3" />}
                </span>
                {o.label}
              </button>
            </li>
          );
        })}
      </ul>
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="w-full border-t border-border bg-surface-muted py-2.5 text-sm font-semibold text-text hover:bg-border/60"
        >
          Clear Filter
        </button>
      )}
    </div>
  );
}
