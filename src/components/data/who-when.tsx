import { formatDate, formatDateTime } from "@/lib/dates";

export type PersonName = { firstName: string; lastName: string | null } | null | undefined;

export const personName = (p: PersonName) => (p ? [p.firstName, p.lastName].filter(Boolean).join(" ") : null);

type WhoWhenProps = {
  by: PersonName;
  at: Date | null | undefined;
  /** Show the time as well as the date. */
  time?: boolean;
};

/** "Arun Owner" over "30-09-2026" — for Created by / Last edited by cells. */
export function WhoWhen({ by, at, time }: WhoWhenProps) {
  if (!at) return <span className="text-text-muted">—</span>;
  return (
    <span className="flex flex-col leading-tight">
      <span>{personName(by) ?? "System"}</span>
      <span className="text-xs text-text-muted">{time ? formatDateTime(at) : formatDate(at)}</span>
    </span>
  );
}
