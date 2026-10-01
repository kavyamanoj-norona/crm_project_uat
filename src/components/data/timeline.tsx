import { cn } from "@/lib/cn";

export type TimelineItem = {
  key: string;
  /** Rendered icon element, e.g. <Wrench className="size-4" />. */
  icon: React.ReactNode;
  title: string;
  /** Shown after the title: "Moved to Diagnosis — working on it". */
  detail?: string | null;
  /** Second line: "30 Sept 2026, 12:10 pm · Admin Owner". */
  meta: string;
  tone?: "default" | "danger";
};

/** Vertical event list, newest first. The first item is highlighted as the latest. */
export function Timeline({ items, highlightFirst = true }: { items: TimelineItem[]; highlightFirst?: boolean }) {
  if (items.length === 0) return <p className="text-sm text-text-muted">Nothing has happened yet.</p>;

  return (
    <ol className="relative space-y-1">
      {/* the rail */}
      <span aria-hidden className="absolute top-3 bottom-3 left-[5px] w-0.5 bg-border" />
      {items.map((item, i) => {
        const latest = highlightFirst && i === 0;
        const danger = item.tone === "danger";
        return (
          <li key={item.key} className="relative flex items-start gap-3 pl-6">
            <span
              aria-hidden
              className={cn(
                "absolute top-4 left-0 size-3 rounded-full ring-4 ring-surface",
                latest ? (danger ? "bg-danger" : "bg-primary") : "bg-border",
              )}
            />
            <div className={cn("flex w-full items-start gap-3 rounded-lg px-2.5 py-2", latest && (danger ? "bg-danger/8" : "bg-primary-soft"))}>
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
                  danger ? "bg-danger/12 text-danger" : latest ? "bg-surface text-primary" : "bg-surface-muted text-text-muted",
                )}
              >
                {item.icon}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-sm">
                  <span className={cn("font-semibold", latest && !danger && "text-brand-navy dark:text-text", danger && "text-danger")}>
                    {item.title}
                  </span>
                  {item.detail && <span className="text-text-muted"> — {item.detail}</span>}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{item.meta}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
