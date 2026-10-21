// How a branch Stock Request reads: each line is a PurchaseRequest, the request's status is rolled up from its lines.

export type Tone = "warning" | "danger" | "primary" | "indigo" | "success" | "neutral";

/** One colour per line status, the same as the Purchasing page. */
export const LINE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Pending", tone: "warning" },
  WITH_PM: { label: "Pending", tone: "warning" },
  APPROVED: { label: "Pending", tone: "warning" },
  SPARE_UNAVAILABLE: { label: "Spare not available", tone: "danger" },
  ORDERED: { label: "Ordered", tone: "primary" },
  TRANSFERRED: { label: "Transferred", tone: "indigo" },
  CONSUMED: { label: "Transferred", tone: "indigo" },
  FULFILLED: { label: "Transferred", tone: "indigo" },
  REJECTED: { label: "Rejected", tone: "danger" },
};

const DONE = new Set(["TRANSFERRED", "CONSUMED", "FULFILLED"]);

export function stockRequestStatus(lines: { status: string }[]): { label: string; tone: Tone } {
  const live = lines.filter((l) => l.status !== "REJECTED");
  if (live.length === 0) return { label: "Rejected", tone: "danger" };
  const done = live.filter((l) => DONE.has(l.status)).length;
  if (done === live.length) return { label: "Transferred", tone: "indigo" };
  if (done > 0) return { label: "Partly transferred", tone: "primary" };
  if (live.some((l) => l.status === "ORDERED")) return { label: "Ordered", tone: "primary" };
  if (live.every((l) => l.status === "SPARE_UNAVAILABLE")) return { label: "Spare not available", tone: "danger" };
  return { label: "Pending", tone: "warning" };
}
