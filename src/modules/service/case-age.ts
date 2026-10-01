import { isOpenStatus, type CaseStatusValue } from "./case-schema";

/** Hours a case may sit in a stage before it counts as late (from Master Settings → Rules). */
export type TatLimits = Partial<Record<CaseStatusValue, number>>;

const HOUR = 60 * 60 * 1000;

/** 45m · 6h · 3d */
export function formatAge(ms: number) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (24 * 60))}d`;
}

/**
 * How long the case has been in its current stage, and whether that is past
 * the stage's TAT. Closed and cancelled cases have no age.
 */
export function caseAge(status: CaseStatusValue, since: Date, limits: TatLimits, now: Date = new Date()) {
  if (!isOpenStatus(status)) return null;
  const ms = now.getTime() - since.getTime();
  const limit = limits[status];
  const overdue = limit !== undefined && limit > 0 && ms > limit * HOUR;
  if (status === "READY_FOR_DELIVERY" && overdue) {
    const days = Math.floor(ms / (24 * HOUR));
    return { label: `${days} ${days === 1 ? "day" : "days"} — uncollected`, overdue };
  }
  return { label: formatAge(ms), overdue };
}
