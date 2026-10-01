"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/cn";
import { MONTHS, RANGES, periodQuery, type PeriodSelection, type PeriodView, type RangeKey } from "@/lib/report-period";
import { FilterChip } from "./filter-chip";
import { OptionList } from "./option-list";

type ReportPeriodFilterProps = {
  /** Page the filter drives, e.g. "/service/dashboard". */
  path: string;
  /** Parsed from the URL on the server with parsePeriodSelection(). */
  selection: PeriodSelection;
  /** Years offered, newest first. */
  years: number[];
  /** Today in IST (yyyy-mm-dd) — no picking future dates or months. */
  today: string;
};

const VIEWS: { key: PeriodView; label: string }[] = [
  { key: "day", label: "Daily Report" },
  { key: "month", label: "Monthly Report" },
  { key: "year", label: "Yearly Report" },
];

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

/**
 * Daily (date or range) · Monthly (year + month) · Yearly (year) report filter.
 * State lives in the URL (view, date, range, year, month); no params = Daily · Today.
 */
export function ReportPeriodFilter({ path, selection, years, today }: ReportPeriodFilterProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ty, tm] = today.split("-").map(Number) as [number, number];

  const go = (next: Parameters<typeof periodQuery>[0]) => {
    const qs = new URLSearchParams(periodQuery(next)).toString();
    start(() => router.push(qs ? `${path}?${qs}` : path, { scroll: false }));
  };

  const switchView = (view: PeriodView) => {
    if (view === selection.view) return;
    go(view === "day" ? { view } : { view, year: ty, month: tm });
  };

  const yearOptions = years.map((y) => ({ value: String(y), label: String(y) }));
  const monthOptions = MONTHS.map((m, i) => ({
    value: String(i + 1),
    label: m,
    disabled: selection.year === ty && i + 1 > tm, // future months
  }));
  const isDefault = selection.view === "day" && !selection.date && (selection.range ?? "today") === "today";

  return (
    <div className={cn("flex flex-wrap items-center gap-2 transition-opacity", pending && "opacity-60")} aria-busy={pending}>
      <div role="tablist" aria-label="Report period" className="flex rounded-lg bg-primary-soft/70 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={selection.view === v.key}
            onClick={() => switchView(v.key)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              selection.view === v.key ? "bg-surface font-medium text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {selection.view === "day" && (
        <>
          <FilterChip label="Date" value={selection.date ? dateLabel(selection.date) : undefined} icon={<CalendarDays className="size-4" />}>
            {(close) => (
              <div>
                <div className="p-3">
                  <label htmlFor="report-date" className="mb-1.5 block text-xs font-medium text-text-muted">
                    Pick a day
                  </label>
                  <input
                    id="report-date"
                    type="date"
                    max={today}
                    defaultValue={selection.date ?? today}
                    autoFocus
                    onChange={(e) => {
                      if (!e.target.value) return;
                      close();
                      go({ view: "day", date: e.target.value });
                    }}
                    className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    close();
                    go({ view: "day" });
                  }}
                  className="w-full border-t border-border bg-surface-muted py-2.5 text-sm font-semibold hover:bg-border/60"
                >
                  Clear Filter
                </button>
              </div>
            )}
          </FilterChip>
          <FilterChip label="Range" value={selection.date ? undefined : RANGES[selection.range ?? "today"].label}>
            {(close) => (
              <OptionList
                searchPlaceholder="Range"
                options={Object.entries(RANGES).map(([value, r]) => ({ value, label: r.label }))}
                selected={selection.date ? undefined : (selection.range ?? "today")}
                onSelect={(range) => {
                  close();
                  go({ view: "day", range: range as RangeKey });
                }}
                onClear={() => {
                  close();
                  go({ view: "day" });
                }}
              />
            )}
          </FilterChip>
        </>
      )}

      {selection.view !== "day" && (
        <FilterChip label="Year" value={String(selection.year)}>
          {(close) => (
            <OptionList
              options={yearOptions}
              selected={String(selection.year)}
              onSelect={(y) => {
                close();
                // keep the month unless it would be in the future
                const year = Number(y);
                go({ view: selection.view, year, month: year === ty ? Math.min(selection.month, tm) : selection.month });
              }}
              onClear={() => {
                close();
                go({ view: selection.view, year: ty, month: tm });
              }}
            />
          )}
        </FilterChip>
      )}

      {selection.view === "month" && (
        <FilterChip label="Month" value={MONTHS[selection.month - 1]}>
          {(close) => (
            <OptionList
              searchPlaceholder="Month"
              options={monthOptions}
              selected={String(selection.month)}
              onSelect={(m) => {
                close();
                go({ view: "month", year: selection.year, month: Number(m) });
              }}
              onClear={() => {
                close();
                go({ view: "month", year: ty, month: tm });
              }}
            />
          )}
        </FilterChip>
      )}

      <button
        type="button"
        onClick={() => go({ view: "day" })}
        disabled={isDefault}
        className="h-10 rounded-lg bg-surface-muted px-4 text-sm font-medium text-text hover:bg-border/70 disabled:opacity-50"
      >
        Reset
      </button>
    </div>
  );
}
