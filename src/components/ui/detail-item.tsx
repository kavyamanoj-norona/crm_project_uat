import { cn } from "@/lib/cn";

/** One term/value pair of a details card; empty values show "—". Place inside a <dl>. */
export function DetailItem({ term, className, children }: { term: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium tracking-wide text-text-muted uppercase">{term}</dt>
      <dd className={cn("mt-1 text-sm break-words text-text")}>{children || "—"}</dd>
    </div>
  );
}
