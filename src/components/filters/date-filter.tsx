"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarDays, Filter } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ReportType } from "@/lib/parse-date-filter";

export type { ReportType };

const REPORT_TABS: { label: string; value: ReportType }[] = [
  { label: "Daily Report", value: "daily" },
  { label: "Monthly Report", value: "monthly" },
  { label: "Yearly Report", value: "yearly" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function currentYear() {
  return new Date().getFullYear();
}
function todayStr() {
  return new Date().toISOString().slice(0, 10); // yyyy-mm-dd
}
function todayMonth() {
  return new Date().getMonth() + 1; // 1-12
}

export function DateFilter({ className }: { className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const report = (sp.get("report") ?? "daily") as ReportType;
  const date = sp.get("date") ?? "";
  const from = sp.get("from") ?? "";
  const to = sp.get("to") ?? "";
  const year = sp.get("year") ?? String(currentYear());
  const month = sp.get("month") ?? "";

  function push(updates: Record<string, string | null>) {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) p.delete(k);
      else p.set(k, v);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  function setReport(r: ReportType) {
    push({ report: r, date: null, from: null, to: null, month: null });
  }

  function setToday() {
    const today = new Date();
    const d = today.toISOString().slice(0, 10);
    const m = String(today.getMonth() + 1);
    const y = String(today.getFullYear());
    if (report === "daily") push({ report: "daily", date: d, from: null, to: null });
    else if (report === "monthly") push({ report: "monthly", month: m, year: y, date: null, from: null, to: null });
    else push({ report: "yearly", year: y, date: null, from: null, to: null });
  }

  function reset() {
    push({ date: null, from: null, to: null, month: null, year: null, report: "daily" });
  }

  const isToday =
    (report === "daily" && date === todayStr()) ||
    (report === "monthly" && month === String(todayMonth()) && year === String(currentYear())) ||
    (report === "yearly" && year === String(currentYear()));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Report type tabs */}
      <div className="flex overflow-hidden rounded-lg border border-border bg-surface text-sm shadow-sm">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setReport(tab.value)}
            className={cn(
              "px-4 py-2 font-medium transition-colors",
              report === tab.value
                ? "bg-surface font-bold text-text shadow-[inset_0_-2px_0_0] shadow-primary"
                : "text-text-muted hover:text-text",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date / Range pickers */}
      <div className="flex overflow-hidden rounded-lg border border-border bg-surface text-sm shadow-sm">
        {/* Date picker — single date (daily) or month+year (monthly) or year (yearly) */}
        <label className="flex cursor-pointer items-center gap-1.5 border-r border-border px-3 py-2 font-medium text-text-muted hover:bg-surface hover:text-text">
          <CalendarDays className="size-4" />
          {report === "daily" && (
            <input
              type="date"
              value={date}
              max={todayStr()}
              onChange={(e) => push({ date: e.target.value, from: null, to: null })}
              className="w-0 opacity-0 absolute"
            />
          )}
          {report === "monthly" && (
            <input
              type="month"
              value={month && year ? `${year}-${month.padStart(2, "0")}` : ""}
              max={`${currentYear()}-${String(todayMonth()).padStart(2, "0")}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split("-");
                push({ year: y, month: String(parseInt(m, 10)), date: null, from: null, to: null });
              }}
              className="w-0 opacity-0 absolute"
            />
          )}
          {report === "yearly" && (
            <select
              value={year}
              onChange={(e) => push({ year: e.target.value, date: null, from: null, to: null })}
              className="bg-transparent text-sm font-medium text-text focus:outline-none"
            >
              {Array.from({ length: 5 }, (_, i) => currentYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          )}
          <span>
            {report === "daily" && (date ? new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "Date")}
            {report === "monthly" && (month && year ? `${MONTHS[parseInt(month) - 1]} ${year}` : "Date")}
            {report === "yearly" && (year || "Year")}
          </span>
        </label>

        {/* Range picker — daily only */}
        {report === "daily" && (
          <label className="flex cursor-pointer items-center gap-1.5 border-r border-border px-3 py-2 font-medium text-text-muted hover:bg-surface hover:text-text">
            <Filter className="size-4" />
            <span className="text-sm">
              {from && to
                ? `${new Date(from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${new Date(to).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                : "Range"}
            </span>
            {/* Two date inputs grouped for from/to */}
            <input
              type="date"
              value={from}
              max={to || todayStr()}
              onChange={(e) => push({ from: e.target.value, date: null })}
              className="w-0 opacity-0 absolute"
            />
          </label>
        )}

        {/* Today shortcut */}
        <button
          type="button"
          onClick={setToday}
          className={cn(
            "border-r border-border px-3 py-2 text-sm font-medium transition-colors",
            isToday ? "text-text font-bold" : "text-text-muted hover:text-text",
          )}
        >
          Today
        </button>

        {/* Reset */}
        <button
          type="button"
          onClick={reset}
          className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

