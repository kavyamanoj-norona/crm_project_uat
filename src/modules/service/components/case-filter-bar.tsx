"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";
import { CASE_STATUSES, CASE_STATUS_LABELS } from "../case-schema";

type ChipOption = { value: string; label: string };
type ListRef = Pick<ListState, "path" | "query" | "prefix">;

// ─── Date utilities ───────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(ymd: string) {
  if (!ymd) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Calendar picker ──────────────────────────────────────────────────────────

function CalendarPicker({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const today = toYMD(new Date());

  const initBase = from || today;
  const [viewYear, setViewYear] = useState(() => parseInt(initBase.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initBase.slice(5, 7)) - 1);
  const [hovered, setHovered] = useState<string | null>(null);

  // Determine whether next click picks "from" or "to"
  const selectingTo = !!(from && !to);

  // Effective range for display (including hover preview)
  const effFrom = selectingTo && hovered && hovered < from ? hovered : from;
  const effTo = selectingTo && hovered
    ? hovered >= from ? hovered : from
    : to;

  function handleDayClick(date: string) {
    if (!selectingTo) {
      // Start fresh selection
      onChange(date, "");
    } else {
      // Completing the range
      if (date === from) {
        onChange("", ""); // deselect
      } else if (date < from) {
        onChange(date, from);
      } else {
        onChange(from, date);
      }
    }
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  // Build day grid (6 rows × 7 = 42 cells)
  const firstDay = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  const cells: Array<{ date: string; day: number; current: boolean }> = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(viewYear, viewMonth, -i);
    cells.push({ date: toYMD(d), day: d.getDate(), current: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: toYMD(new Date(viewYear, viewMonth, d)), day: d, current: true });
  }
  for (let d = 1; cells.length < 42; d++) {
    cells.push({ date: toYMD(new Date(viewYear, viewMonth + 1, d)), day: d, current: false });
  }

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={prevMonth}
          className="rounded-lg p-1 text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-text">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="rounded-lg p-1 text-text-muted hover:bg-surface-muted hover:text-text"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3">
        {DAY_HEADERS.map((h) => (
          <div
            key={h}
            className="flex h-7 items-center justify-center text-[11px] font-semibold uppercase tracking-wide text-text-muted"
          >
            {h}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-3 pb-3">
        {cells.map((cell, i) => {
          const isStart = cell.date === effFrom && effFrom !== "";
          const isEnd = cell.date === effTo && effTo !== "";
          const inRange = !!(effFrom && effTo && cell.date > effFrom && cell.date < effTo);
          const isToday = cell.date === today;

          // Strip positions: start → strip begins at center going right
          //                  end   → strip ends at center from left
          //                  middle → full-width strip
          const stripLeft = isStart && !isEnd ? "left-1/2" : "left-0";
          const stripRight = isEnd && !isStart ? "right-1/2" : "right-0";
          const showStrip = (isStart || isEnd || inRange) && !(isStart && isEnd);

          return (
            <div
              key={i}
              className="relative h-9"
              onMouseEnter={() => selectingTo && setHovered(cell.date)}
              onMouseLeave={() => setHovered(null)}
            >
              {/* Range highlight strip */}
              {showStrip && (
                <div
                  className={cn(
                    "absolute inset-y-1 bg-primary/10",
                    stripLeft,
                    stripRight,
                  )}
                />
              )}

              {/* Day button */}
              <button
                type="button"
                onClick={() => handleDayClick(cell.date)}
                className={cn(
                  "relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors",
                  isStart || isEnd
                    ? "bg-primary font-semibold text-white"
                    : inRange
                      ? "text-primary hover:bg-primary/20"
                      : "hover:bg-surface-muted",
                  isToday && !isStart && !isEnd && "font-bold",
                  !cell.current && "text-text-disabled",
                  cell.current && !isStart && !isEnd && !inRange && "text-text",
                )}
              >
                {cell.day}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Popover wrapper ──────────────────────────────────────────────────────────

function Popover({
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
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onToggle]);

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Chip button ──────────────────────────────────────────────────────────────

function ChipBtn({
  icon: Icon,
  label,
  valueLabel,
  active,
  open,
  onClick,
  onClear,
}: {
  icon: React.ElementType;
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
      <Icon className="size-3.5 shrink-0" />
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
        <ChevronDown className={cn("size-3.5 text-text-muted transition-transform", open && "rotate-180")} />
      )}
    </button>
  );
}

// ─── Date-range filter ────────────────────────────────────────────────────────

function DateRangeFilter({ from, to, list }: { from: string; to: string; list: ListRef }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const active = !!(from || to);
  const valueLabel = from && to
    ? `${fmtDate(from)} - ${fmtDate(to)}`
    : from ? `From ${fmtDate(from)}`
    : to ? `To ${fmtDate(to)}`
    : undefined;

  function openPicker() {
    setLocalFrom(from);
    setLocalTo(to);
    setOpen((o) => !o);
  }

  function clear() {
    setLocalFrom(""); setLocalTo("");
    router.replace(listHref(list, { from: null, to: null }), { scroll: false });
  }

  function handleCalendarChange(f: string, t: string) {
    setLocalFrom(f);
    setLocalTo(t);
    // Auto-apply once the range is complete (both dates chosen)
    if (f && t) {
      router.replace(listHref(list, { from: f, to: t }), { scroll: false });
      setOpen(false);
    }
  }

  return (
    <Popover
      open={open}
      onToggle={openPicker}
      trigger={
        <ChipBtn
          icon={Calendar}
          label="Date"
          valueLabel={valueLabel}
          active={active}
          open={open}
          onClick={openPicker}
          onClear={clear}
        />
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2.5">
        <p className="text-sm font-semibold text-text">Date</p>
        {(localFrom || localTo) && (
          <button
            type="button"
            onClick={clear}
            className="text-xs font-medium text-text-muted hover:text-text"
          >
            Clear
          </button>
        )}
      </div>

      {/* Calendar — auto-applies when range is complete */}
      <div className="w-full max-w-72">
        <CalendarPicker
          from={localFrom}
          to={localTo}
          onChange={handleCalendarChange}
        />
      </div>
    </Popover>
  );
}

// ─── Select filter (with search) ─────────────────────────────────────────────

function SelectFilter({
  label,
  icon: Icon,
  options,
  value,
  param,
  list,
}: {
  label: string;
  icon: React.ElementType;
  options: ChipOption[];
  value: string;
  param: string;
  list: ListRef;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((o) => o.value === value);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  function select(v: string) {
    router.replace(listHref(list, { [param]: v || null }), { scroll: false });
    setOpen(false);
    setQuery("");
  }

  function clear() {
    router.replace(listHref(list, { [param]: null }), { scroll: false });
  }

  function toggle() {
    setOpen((o) => {
      if (!o) setTimeout(() => inputRef.current?.focus(), 10);
      return !o;
    });
    setQuery("");
  }

  return (
    <Popover
      open={open}
      onToggle={toggle}
      trigger={
        <ChipBtn
          icon={Icon}
          label={label}
          valueLabel={selected?.label}
          active={!!value}
          open={open}
          onClick={toggle}
          onClear={clear}
        />
      }
    >
      {/* Search bar — like FacetedFilter's ComboboxInput */}
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

      {/* Options list */}
      <div className="max-h-60 overflow-y-auto py-1">
        {filtered.length === 0 ? (
          <p className="px-4 py-3 text-sm text-text-muted">
            Nothing found for &ldquo;{query}&rdquo;
          </p>
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

      {/* Clear — like FacetedFilter's Clear Filter button */}
      {value && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={() => { clear(); setOpen(false); }}
            className="flex w-full items-center justify-center py-2 text-xs text-text-muted hover:bg-surface-muted hover:text-text"
          >
            Clear filter
          </button>
        </div>
      )}
    </Popover>
  );
}

// ─── Exported bar ─────────────────────────────────────────────────────────────

export type CaseFilterBarProps = {
  list: ListRef;
  staffOptions: ChipOption[];
  typeOptions: ChipOption[];
  activeStatus: string;
  activeStaff: string;
  activeType: string;
  activeFrom: string;
  activeTo: string;
};

const STATUS_OPTIONS: ChipOption[] = CASE_STATUSES.map((s) => ({
  value: s,
  label: CASE_STATUS_LABELS[s],
}));

export function CaseFilterBar({
  list,
  staffOptions,
  typeOptions,
  activeStatus,
  activeStaff,
  activeType,
  activeFrom,
  activeTo,
}: CaseFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <DateRangeFilter from={activeFrom} to={activeTo} list={list} />
      <SelectFilter
        label="Status"
        icon={Activity}
        options={STATUS_OPTIONS}
        value={activeStatus}
        param="status"
        list={list}
      />
      <SelectFilter
        label="Staff"
        icon={Users}
        options={staffOptions}
        value={activeStaff}
        param="engineer"
        list={list}
      />
      <SelectFilter
        label="Type"
        icon={Filter}
        options={typeOptions}
        value={activeType}
        param="type"
        list={list}
      />
    </div>
  );
}
