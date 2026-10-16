"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type SearchSelectOption = { value: string; label: string };

type Props = {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Always shown at the top of the list (e.g. "+ Add new item"). */
  pinned?: SearchSelectOption[];
  invalid?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
};

/**
 * A dropdown you can type into to filter, and scroll. The list opens as a floating panel (fixed position), so it is
 * not clipped by a table or card it sits in. Arrow keys move, Enter picks, Esc closes.
 */
export function SearchSelect({ options, value, onChange, placeholder = "Select…", pinned = [], invalid, id, className, "aria-label": ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const all = useMemo(() => [...pinned, ...options], [pinned, options]);
  const selected = all.find((o) => o.value === value);

  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const match = (o: SearchSelectOption) => words.every((w) => o.label.toLowerCase().includes(w));
    return [...pinned, ...options.filter(match)];
  }, [q, pinned, options]);

  const openPanel = () => {
    const r = button.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - Math.max(r.width, 320))),
      width: Math.max(r.width, 320),
      ...(below < 300 && r.top > below ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }),
    });
    setQ("");
    setActive(Math.max(0, shown.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const close = () => setOpen(false);

  const pick = (o: SearchSelectOption) => {
    onChange(o.value);
    close();
    button.current?.focus();
  };

  // Close on outside click, resize, or when the page scrolls under the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onScroll = (e: Event) => {
      if (!panel.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Keep the active row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return;
    list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(shown.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = shown[active];
      if (o) pick(o);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
      button.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left text-sm outline-none transition-colors focus:border-primary",
          invalid ? "border-danger" : open ? "border-primary" : "border-border",
          className,
        )}
      >
        <span className={cn("min-w-0 truncate", selected ? "text-text" : "text-text-muted")}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && pos && (
        <div
          ref={panel}
          style={{ position: "fixed", left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom }}
          className="z-[60] rounded-lg border border-border bg-surface p-2 shadow-xl"
          onKeyDown={onKey}
        >
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              placeholder="Search by code or name"
              aria-label="Search"
              className="h-9 w-full rounded-lg border border-border bg-surface pl-8 pr-2 text-sm outline-none focus:border-primary"
            />
          </div>
          <ul ref={list} role="listbox" className="max-h-64 overflow-y-auto overscroll-contain">
            {shown.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-text-muted">Nothing matches “{q}”.</li>
            ) : (
              shown.map((o, i) => (
                <li
                  key={o.value}
                  role="option"
                  aria-selected={o.value === value}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(o);
                  }}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-2 rounded-md px-3 py-2 text-sm",
                    i === active && "bg-primary-soft",
                    pinned.some((p) => p.value === o.value) && "font-medium text-primary",
                  )}
                >
                  <span className="min-w-0">{o.label}</span>
                  {o.value === value && <Check className="size-4 shrink-0 text-primary" />}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </>
  );
}

/**
 * SearchSelect for ordinary (uncontrolled) forms: it keeps its own value and submits it under `name`, like a native select
 * would, so it can replace a long <select> without changing the form or its action.
 */
export function SearchSelectField({
  name,
  options,
  defaultValue = "",
  pinned,
  placeholder,
  invalid,
  id,
}: {
  name: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  pinned?: SearchSelectOption[];
  placeholder?: string;
  invalid?: boolean;
  id?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value} />
      <SearchSelect id={id} value={value} onChange={setValue} options={options} pinned={pinned} placeholder={placeholder} invalid={invalid} />
    </>
  );
}
