"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/money";
import { useDismiss } from "@/hooks/use-dismiss";
import { ITEM_TYPE_LABELS } from "@/modules/admin/item-schema";
import type { CatalogItem } from "../queries";

type ItemPickerProps = {
  catalog: CatalogItem[];
  /** Item ids already on the estimate (hidden from results). */
  exclude: Set<string>;
  onPick: (item: CatalogItem) => void;
};

const matches = (i: CatalogItem, q: string) =>
  [i.code, i.name, i.category, i.brand].some((v) => v?.toLowerCase().includes(q));

/** Search-as-you-type over the item catalog; Enter adds the first match. */
export function ItemPicker({ catalog, exclude, onPick }: ItemPickerProps) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { open, setOpen, ref } = useDismiss();
  const results = catalog.filter((i) => !exclude.has(i.id) && (!q || matches(i, q.toLowerCase()))).slice(0, 30);

  const pick = (item: CatalogItem | undefined) => {
    if (!item) return;
    onPick(item);
    setQ("");
    setActive(0);
  };

  return (
    <div ref={ref} className="relative">
      <label className="flex h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 focus-within:border-primary">
        <Search className="size-4 text-text-muted" />
        <span className="sr-only">Add item</span>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, results.length - 1));
            else if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            else if (e.key === "Enter") {
              e.preventDefault(); // don't submit the form
              pick(results[active]);
            } else return;
            e.preventDefault();
          }}
          role="combobox"
          aria-expanded={open}
          aria-controls="item-results"
          placeholder="Add an item — search code, name, category…"
          className="h-full w-full bg-transparent text-sm outline-none placeholder:text-text-muted"
        />
      </label>
      {open && (
        <ul id="item-results" role="listbox" className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-border bg-surface py-1 shadow-lg">
          {results.length === 0 && (
            <li className="px-4 py-3 text-sm text-text-muted">
              {catalog.length === 0 ? "No items yet — add them in Master Settings → Manage → Items." : "No matching item."}
            </li>
          )}
          {results.map((i, n) => (
            <li key={i.id} role="option" aria-selected={n === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(n)}
                onClick={() => pick(i)}
                className={cn("flex w-full items-center gap-3 px-4 py-2 text-left text-sm", n === active && "bg-primary-soft")}
              >
                <Plus className="size-4 shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{i.name}</span>
                  <span className="block text-xs text-text-muted">
                    {i.code} · {ITEM_TYPE_LABELS[i.type]}
                    {i.category && ` · ${i.category}`}
                  </span>
                </span>
                <span className="text-right text-xs">
                  <span className="block font-semibold tabular-nums">{formatPaise(i.pricePaise)}</span>
                  <span className="block text-text-muted">min {formatPaise(i.minPricePaise)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
