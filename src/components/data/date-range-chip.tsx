"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";
import { ChipBtn, ChipPopover } from "./filter-chip";

type ListRef = Pick<ListState, "path" | "query" | "prefix">;

// ─── Date utilities ───────────────────────────────────────────────────────────

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(ymd: string) {
  if (!ymd) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${ymd}T12:00:00`));
  } catch {
    return ymd;
  }
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// ─── Calendar picker ──────────────────────────────────────────────────────────

function CalendarPicker({ from, to, max, onChange }: { from: string; to: string; max?: string; onChange: (from: string, to: string) => void }) {
  const today = toYMD(new Date());

  const initBase = from || today;
  const [viewYear, setViewYear] = useState(() => parseInt(initBase.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => parseInt(initBase.slice(5, 7)) - 1);
  const [hovered, setHovered] = useState<string | null>(null);

  // Whether the next click picks "from" or "to"
  const selectingTo = !!(from && !to);

  // Effective range for display (including hover preview)
  const effFrom = selectingTo && hovered && hovered < from ? hovered : from;
  const effTo = selectingTo && hovered ? (hovered >= from ? hovered : from) : to;

  function handleDayClick(date: string) {
    if (!selectingTo) onChange(date, "");
    // Clicking the start day again picks that single day.
    else if (date < from) onChange(date, from);
    else onChange(from, date);
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
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: toYMD(new Date(viewYear, viewMonth, d)), day: d, current: true });
  for (let d = 1; cells.length < 42; d++) cells.push({ date: toYMD(new Date(viewYear, viewMonth + 1, d)), day: d, current: false });

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2">
        <button type="button" onClick={prevMonth} aria-label="Previous month" className="rounded-lg p-1 text-text-muted hover:bg-surface-muted hover:text-text">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold text-text">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} aria-label="Next month" className="rounded-lg p-1 text-text-muted hover:bg-surface-muted hover:text-text">
          <ChevronRight className="size-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3">
        {DAY_HEADERS.map((h) => (
          <div key={h} className="flex h-6 items-center justify-center text-[11px] font-semibold tracking-wide text-text-muted uppercase">
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
          const disabled = Boolean(max && cell.date > max);

          // Strip positions: start → strip begins at centre going right; end → strip ends at centre from left; middle → full width
          const stripLeft = isStart && !isEnd ? "left-1/2" : "left-0";
          const stripRight = isEnd && !isStart ? "right-1/2" : "right-0";
          const showStrip = (isStart || isEnd || inRange) && !(isStart && isEnd);

          return (
            <div key={i} className="relative h-8" onMouseEnter={() => selectingTo && setHovered(cell.date)} onMouseLeave={() => setHovered(null)}>
              {showStrip && <div className={cn("absolute inset-y-1 bg-primary/10", stripLeft, stripRight)} />}
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleDayClick(cell.date)}
                className={cn(
                  "relative z-10 mx-auto flex size-7 items-center justify-center rounded-full text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  isStart || isEnd ? "bg-primary font-semibold text-white" : inRange ? "text-primary hover:bg-primary/20" : "hover:bg-surface-muted",
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

// ─── Date-range chip ──────────────────────────────────────────────────────────

/**
 * A "Date" filter chip that opens a range calendar and writes `from` / `to` into the URL.
 * The range applies as soon as both ends are picked; clicking the same day twice picks just that day.
 */
export function DateRangeChip({
  from,
  to,
  list,
  max,
  label = "Date",
  align,
}: {
  from: string;
  to: string;
  list: ListRef;
  /** Last selectable day (yyyy-mm-dd). */
  max?: string;
  label?: string;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [localFrom, setLocalFrom] = useState(from);
  const [localTo, setLocalTo] = useState(to);

  const active = !!(from || to);
  const valueLabel =
    from && to ? (from === to ? fmtDate(from) : `${fmtDate(from)} - ${fmtDate(to)}`) : from ? `From ${fmtDate(from)}` : to ? `To ${fmtDate(to)}` : undefined;

  function toggle() {
    setLocalFrom(from);
    setLocalTo(to);
    setOpen((o) => !o);
  }

  function clear() {
    setLocalFrom("");
    setLocalTo("");
    router.replace(listHref(list, { from: null, to: null }), { scroll: false });
  }

  function handleCalendarChange(f: string, t: string) {
    setLocalFrom(f);
    setLocalTo(t);
    if (f && t) {
      router.replace(listHref(list, { from: f, to: t }), { scroll: false });
      setOpen(false);
    }
  }

  return (
    <ChipPopover
      open={open}
      onToggle={toggle}
      align={align}
      trigger={<ChipBtn icon={Calendar} label={label} valueLabel={valueLabel} active={active} open={open} onClick={toggle} onClear={clear} />}
    >
      <div className="flex items-center justify-between border-b border-border bg-surface-muted px-4 py-2.5">
        <p className="text-sm font-semibold text-text">{label}</p>
        {(localFrom || localTo) && (
          <button type="button" onClick={clear} className="text-xs font-medium text-text-muted hover:text-text">
            Clear
          </button>
        )}
      </div>
      <div className="w-64 max-w-[calc(100vw-2rem)]">
        <CalendarPicker from={localFrom} to={localTo} max={max} onChange={handleCalendarChange} />
      </div>
    </ChipPopover>
  );
}
