import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

export const PAY_STATUS = {
  UNPAID: { label: "Unpaid", tone: "danger" },
  PARTIAL: { label: "Part paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
} as const;

export function PayStatusBadge({ status }: { status: keyof typeof PAY_STATUS }) {
  return <Badge tone={PAY_STATUS[status].tone}>{PAY_STATUS[status].label}</Badge>;
}

export const MODE_LABELS: Record<string, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", OTHER: "Other" };

/** From / To date filter as a plain GET form: no client code, the page reads the dates from the URL. */
export function DateFilter({ from, to, hidden, single }: { from: string; to: string; hidden?: Record<string, string>; single?: boolean }) {
  return (
    <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3">
      {Object.entries(hidden ?? {}).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {!single && (
        <label className="text-xs font-bold text-brand-navy dark:text-text">
          From
          <Input type="date" name="from" defaultValue={from} className="mt-1 w-40" />
        </label>
      )}
      <label className="text-xs font-bold text-brand-navy dark:text-text">
        {single ? "As at" : "To"}
        <Input type="date" name="to" defaultValue={to} className="mt-1 w-40" />
      </label>
      <Button type="submit" variant="secondary">
        Apply
      </Button>
    </form>
  );
}

/** A summary line used by the report pages. */
export function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "pos" | "neg" }) {
  return (
    <div className={`flex justify-between gap-3 py-1.5 text-sm ${strong ? "border-t border-border pt-2 font-bold" : ""}`}>
      <dt className={strong ? "" : "text-text-muted"}>{label}</dt>
      <dd className={`tabular-nums ${tone === "neg" ? "text-danger" : tone === "pos" ? "text-success" : ""}`}>{value}</dd>
    </div>
  );
}
