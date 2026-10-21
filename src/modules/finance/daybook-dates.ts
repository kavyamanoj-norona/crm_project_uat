// Business-day (IST) helpers shared by the Daybook, its lock and the ledger. No imports, so any of them can use it.

/** Today in IST as yyyy-mm-dd. */
export const todayIst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

/** The business day (IST) an instant falls on, as yyyy-mm-dd. */
export const istDate = (at: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(at);

/** The instant a business day starts and the next one starts, in IST. */
export function istDay(date: string) {
  const from = new Date(`${date}T00:00:00+05:30`);
  return { from, to: new Date(from.getTime() + 24 * 60 * 60 * 1000) };
}

/** The business day as a DATE column value. */
export const dayValue = (date: string) => new Date(`${date}T00:00:00Z`);

export const isDateString = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(`${v}T00:00:00Z`).getTime());
