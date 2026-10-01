// Report period for dashboards: Daily (one date, or a range such as Last 7
// Days) · Monthly (year + month) · Yearly (year). Pure — shared by the filter
// component and server queries. All boundaries are business days in IST.

export type PeriodView = "day" | "month" | "year";

export const RANGES = {
  today: { label: "Today", days: 1, endOffset: 0 },
  yesterday: { label: "Yesterday", days: 1, endOffset: 1 },
  last7: { label: "Last 7 Days", days: 7, endOffset: 0 },
  last15: { label: "Last 15 Days", days: 15, endOffset: 0 },
  last30: { label: "Last 30 Days", days: 30, endOffset: 0 },
} as const;
export type RangeKey = keyof typeof RANGES;

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

/** What the filter shows as selected (all strings, straight from the URL). */
export type PeriodSelection = {
  view: PeriodView;
  /** Daily: a single date yyyy-mm-dd (takes precedence over range). */
  date?: string;
  range?: RangeKey;
  year: number;
  /** 1–12 */
  month: number;
};

export type Span = { from: Date; to: Date; label: string };

export type ReportPeriod = {
  selection: PeriodSelection;
  /** [from, to) instants. */
  from: Date;
  to: Date;
  /** "Today", "Last 7 Days", "September 2026", "2026", "12 Sept 2026". */
  label: string;
  /** The same-length period just before, for "vs previous" deltas. */
  previous: Span;
  /** "vs yesterday", "vs previous 7 days", "vs August" … */
  compareLabel: string;
  /** Chart buckets across the period (a single day widens to the 7 days ending on it). */
  buckets: Span[];
  /** True when the period is exactly today. */
  isToday: boolean;
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar parts of an instant, in IST. */
function istParts(d: Date) {
  const t = new Date(d.getTime() + IST_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** The instant of IST midnight at the start of y-m-d (month may overflow, Date.UTC normalises). */
const istMidnight = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MS);

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

const dayLabel = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });
const weekday = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short" });
const dayMonth = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });

type Params = Record<string, string | string[] | undefined>;
const str = (sp: Params, k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

/** Reads view / date / range / year / month; anything missing or invalid falls back to today. */
export function parsePeriodSelection(sp: Params, now: Date = new Date()): PeriodSelection {
  const today = istParts(now);
  const view = (["day", "month", "year"] as const).find((v) => v === str(sp, "view")) ?? "day";
  const yearNum = Number(str(sp, "year"));
  const monthNum = Number(str(sp, "month"));
  const year = Number.isInteger(yearNum) && yearNum >= 2000 && yearNum <= today.y ? yearNum : today.y;
  const month = Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : today.m;
  const dateStr = str(sp, "date");
  const date = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !Number.isNaN(Date.parse(dateStr)) ? dateStr : undefined;
  const rangeStr = str(sp, "range");
  const range = rangeStr && rangeStr in RANGES ? (rangeStr as RangeKey) : undefined;
  return { view, date, range: date ? undefined : (range ?? "today"), year, month };
}

function dayBuckets(end: Date, count: number, today: Date): Span[] {
  return Array.from({ length: count }, (_, i) => {
    const from = addDays(end, i - count);
    const label = from.getTime() === today.getTime() ? "Today" : count <= 7 ? weekday.format(from) : dayMonth.format(from);
    return { from, to: addDays(from, 1), label };
  });
}

/** Turns the selection into concrete instants, the comparison period and chart buckets. */
export function resolvePeriod(selection: PeriodSelection, now: Date = new Date()): ReportPeriod {
  const t = istParts(now);
  const today = istMidnight(t.y, t.m, t.d);
  const tomorrow = addDays(today, 1);

  if (selection.view === "month") {
    const { year, month } = selection;
    const from = istMidnight(year, month, 1);
    const to = istMidnight(year, month + 1, 1);
    const prev = istMidnight(year, month - 1, 1);
    const days = Math.round((to.getTime() - from.getTime()) / DAY_MS);
    const shown = to > tomorrow ? Math.max(1, Math.round((tomorrow.getTime() - from.getTime()) / DAY_MS)) : days;
    const prevName = MONTHS[(month + 10) % 12]!;
    return {
      selection,
      from,
      to,
      label: `${MONTHS[month - 1]} ${year}`,
      previous: { from: prev, to: from, label: prevName },
      compareLabel: `vs ${prevName}`,
      buckets: Array.from({ length: shown }, (_, i) => {
        const f = addDays(from, i);
        return { from: f, to: addDays(f, 1), label: String(i + 1) };
      }),
      isToday: false,
    };
  }

  if (selection.view === "year") {
    const { year } = selection;
    const from = istMidnight(year, 1, 1);
    const to = istMidnight(year + 1, 1, 1);
    const months = year === t.y ? t.m : 12;
    return {
      selection,
      from,
      to,
      label: String(year),
      previous: { from: istMidnight(year - 1, 1, 1), to: from, label: String(year - 1) },
      compareLabel: `vs ${year - 1}`,
      buckets: Array.from({ length: months }, (_, i) => ({
        from: istMidnight(year, i + 1, 1),
        to: istMidnight(year, i + 2, 1),
        label: MONTHS[i]!.slice(0, 3),
      })),
      isToday: false,
    };
  }

  // Daily: one picked date …
  if (selection.date) {
    const [y, m, d] = selection.date.split("-").map(Number) as [number, number, number];
    const from = istMidnight(y, m, d);
    const to = addDays(from, 1);
    return {
      selection,
      from,
      to,
      label: from.getTime() === today.getTime() ? "Today" : dayLabel.format(from),
      previous: { from: addDays(from, -1), to: from, label: "the day before" },
      compareLabel: "vs the day before",
      buckets: dayBuckets(to, 7, today),
      isToday: from.getTime() === today.getTime(),
    };
  }

  // … or a range ending today (Yesterday ends yesterday).
  const r = RANGES[selection.range ?? "today"];
  const to = addDays(tomorrow, -r.endOffset);
  const from = addDays(to, -r.days);
  return {
    selection,
    from,
    to,
    label: r.label,
    previous: { from: addDays(from, -r.days), to: from, label: `previous ${r.days === 1 ? "day" : `${r.days} days`}` },
    compareLabel: r.days === 1 ? (r.endOffset === 0 ? "vs yesterday" : "vs the day before") : `vs previous ${r.days} days`,
    buckets: dayBuckets(to, Math.max(r.days, 7), today),
    isToday: r.days === 1 && r.endOffset === 0,
  };
}

/** URL query for a selection — only what differs from the default (Daily · Today). */
export function periodQuery(s: Partial<PeriodSelection> & { view: PeriodView }): Record<string, string> {
  if (s.view === "month") return { view: "month", ...(s.year ? { year: String(s.year) } : {}), ...(s.month ? { month: String(s.month) } : {}) };
  if (s.view === "year") return { view: "year", ...(s.year ? { year: String(s.year) } : {}) };
  if (s.date) return { date: s.date };
  return s.range && s.range !== "today" ? { range: s.range } : {};
}
