import { cn } from "@/lib/cn";

type KvListProps = {
  items: [term: string, value: React.ReactNode][];
  className?: string;
};

/** Compact label → value rows (label column on the left); empty values show "—". */
export function KvList({ items, className }: KvListProps) {
  return (
    <dl className={cn("grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5 text-sm", className)}>
      {items.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="font-medium text-text-muted">{term}</dt>
          <dd className="min-w-0 break-words text-text">{value || value === 0 ? value : "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
