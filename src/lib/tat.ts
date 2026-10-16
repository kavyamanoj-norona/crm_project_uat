/** Turnaround time between two moments as a short label: "35m", "5h 10m", "2d 4h". */
export function formatTat(from: Date | null | undefined, to: Date | null | undefined = new Date()): string {
  if (!from || !to) return "—";
  const mins = Math.max(0, Math.floor((to.getTime() - from.getTime()) / 60_000));
  if (mins < 1) return "<1m";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/** Badge tone for a TAT: closed stages are neutral; a running one turns amber after a day and red after three. */
export function tatTone(from: Date | null | undefined, to?: Date | null): "neutral" | "primary" | "warning" | "danger" {
  if (to) return "neutral";
  if (!from) return "neutral";
  const hours = (Date.now() - from.getTime()) / 3_600_000;
  return hours >= 72 ? "danger" : hours >= 24 ? "warning" : "primary";
}
