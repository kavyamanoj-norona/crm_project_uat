// All timestamps are stored in UTC and shown in IST (blueprint §3).
const TZ = "Asia/Kolkata";

const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** 19-08-2026 */
export function formatDate(d: Date | null | undefined) {
  return d ? dateFmt.format(d).replace(/\//g, "-") : "—";
}

/** 19 Aug 2026, 09:30 am */
export function formatDateTime(d: Date | null | undefined) {
  return d ? dateTimeFmt.format(d) : "—";
}

/** yyyy-mm-dd for <input type="date"> (calendar date columns are stored as UTC midnight). */
export function toDateInput(d: Date | null | undefined) {
  return d ? d.toISOString().slice(0, 10) : "";
}
