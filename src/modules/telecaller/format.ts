import { istDate } from "@/modules/finance/daybook-dates";

const dateTime = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** A Date as the IST wall time a `datetime-local` input expects ("2026-10-19T14:30"); empty for null. */
export function toDateTimeInput(d: Date | null | undefined) {
  if (!d) return "";
  const p = Object.fromEntries(dateTime.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** A Date as an IST `date` input value ("2026-10-19"); empty for null. */
export const toDateInput = (d: Date | null | undefined) => (d ? istDate(d) : "");

const DAY = 86_400_000;

/** Turnaround in days: first interaction → billing. Null until the lead is billed. */
export function tatDays(firstInteractionAt: Date | null, createdAt: Date, billingDate: Date | null) {
  if (!billingDate) return null;
  return Math.max(0, Math.round((billingDate.getTime() - (firstInteractionAt ?? createdAt).getTime()) / DAY));
}
