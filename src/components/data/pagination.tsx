import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";
import { PageSizeSelect } from "./page-size-select";

/** Page numbers to show: first, last, current ±1, with gaps as null. */
function pageWindow(current: number, total: number): (number | null)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push(null);
    out.push(p);
  });
  return out;
}

const box =
  "inline-flex size-8 items-center justify-center rounded-md text-sm font-medium transition-colors";

/** "Show [50] entries · ‹ 1 2 3 › · 1 – 50 of 120 entries" */
export function Pagination({ list, total }: { list: ListState; total: number }) {
  const pages = Math.max(1, Math.ceil(total / list.pageSize));
  const page = Math.min(list.page, pages);
  const from = total === 0 ? 0 : (page - 1) * list.pageSize + 1;
  const to = Math.min(total, page * list.pageSize);

  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-3 rounded-lg border border-border px-4 py-3 text-sm sm:flex-row">
      <PageSizeSelect path={list.path} query={list.query} prefix={list.prefix} value={list.pageSize} />

      <nav aria-label="Pagination" className="flex items-center gap-1 rounded-lg bg-surface-muted p-1">
        <PageLink list={list} page={page - 1} disabled={page <= 1} label="Previous page">
          <ChevronLeft className="size-4" />
        </PageLink>
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap-${i}`} className="px-1 text-text-muted">
              …
            </span>
          ) : (
            <PageLink key={p} list={list} page={p} current={p === page} label={`Page ${p}`}>
              {p}
            </PageLink>
          ),
        )}
        <PageLink list={list} page={page + 1} disabled={page >= pages} label="Next page">
          <ChevronRight className="size-4" />
        </PageLink>
      </nav>

      <p className="text-text-muted">
        {from} – {to} of {total} entries
      </p>
    </div>
  );
}

function PageLink({
  list,
  page,
  current,
  disabled,
  label,
  children,
}: {
  list: ListState;
  page: number;
  current?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className={cn(box, "cursor-not-allowed text-text-muted/50")} aria-disabled="true" aria-label={label}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={listHref(list, { page })}
      scroll={false}
      aria-label={label}
      aria-current={current ? "page" : undefined}
      className={cn(box, current ? "bg-primary text-primary-foreground shadow-sm" : "text-text hover:bg-surface")}
    >
      {children}
    </Link>
  );
}
