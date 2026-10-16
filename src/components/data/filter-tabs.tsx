import Link from "next/link";
import { cn } from "@/lib/cn";
import { listHref, type ListState } from "@/lib/list";
import { FilterSelect } from "./filter-select";

export type FilterTab = { key: string; label: string; count?: number };

/**
 * Segmented filter tabs (All · Admin · Finance …) driven by the `tab` param.
 * Scrolls sideways when there are many tabs; becomes a dropdown on phones.
 */
export function FilterTabs({ list, tabs, tone = "default" }: { list: ListState; tabs: FilterTab[]; tone?: "default" | "blue" }) {
  const blue = tone === "blue";
  const active = tabs.some((t) => t.key === list.tab) ? list.tab : (tabs[0]?.key ?? "");

  return (
    <>
      <FilterSelect
        className="sm:hidden"
        path={list.path}
        query={list.query}
        prefix={list.prefix}
        value={active}
        options={tabs.map((t, i) => ({
          value: i === 0 ? "" : t.key,
          label: t.count === undefined ? t.label : `${t.label} (${t.count})`,
        }))}
      />
      <nav
        aria-label="Filter"
        className={cn(
          "hidden min-w-0 max-w-full overflow-x-auto rounded-lg p-1 [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden",
          blue ? "bg-table-head" : "bg-surface-muted",
        )}
      >
        <div className="flex gap-1">
          {tabs.map((t, i) => (
            <Link
              key={t.key || "__default"}
              href={listHref(list, { tab: i === 0 ? null : t.key })}
              scroll={false}
              aria-current={t.key === active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center justify-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
                blue
                  ? t.key === active
                    ? "bg-surface font-semibold text-brand-navy shadow-sm dark:text-text"
                    : "text-table-head-text/80 hover:bg-surface/60 hover:text-table-head-text"
                  : t.key === active
                    ? "bg-surface font-medium text-text shadow-sm"
                    : "text-text-muted hover:bg-surface/60 hover:text-text",
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] leading-5",
                    t.key === active ? "bg-primary-soft text-primary" : blue ? "bg-surface/70 text-table-head-text" : "bg-surface/80 text-text-muted",
                  )}
                >
                  {t.count}
                </span>
              )}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
