export type ReportType = "daily" | "monthly" | "yearly";

/** Parse the date-filter URL search params into structured values + date range. */
export function parseDateFilter(sp: Record<string, string | string[] | undefined>) {
  const get = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  const report = (get("report") || "daily") as ReportType;
  const date = get("date");
  const from = get("from");
  const to = get("to");
  const year = parseInt(get("year") || String(new Date().getFullYear()), 10);
  const month = get("month") ? parseInt(get("month"), 10) : undefined;

  let rangeStart: Date | undefined;
  let rangeEnd: Date | undefined;

  if (report === "daily") {
    if (from && to) {
      rangeStart = new Date(`${from}T00:00:00`);
      rangeEnd = new Date(`${to}T23:59:59`);
    } else if (date) {
      rangeStart = new Date(`${date}T00:00:00`);
      rangeEnd = new Date(`${date}T23:59:59`);
    } else {
      const today = new Date().toISOString().slice(0, 10);
      rangeStart = new Date(`${today}T00:00:00`);
      rangeEnd = new Date(`${today}T23:59:59`);
    }
  } else if (report === "monthly" && month) {
    rangeStart = new Date(year, month - 1, 1);
    rangeEnd = new Date(year, month, 0, 23, 59, 59);
  } else {
    rangeStart = new Date(year, 0, 1);
    rangeEnd = new Date(year, 11, 31, 23, 59, 59);
  }

  return { report, date, from, to, year, month, rangeStart, rangeEnd };
}
