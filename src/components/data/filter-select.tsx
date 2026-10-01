"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { listHref } from "@/lib/list";

type FilterSelectProps = {
  path: string;
  query: Record<string, string>;
  prefix: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
  /** Query param it sets (default `tab`). */
  param?: string;
  /** Accessible name. */
  label?: string;
};

/** Dropdown filter bound to a query param; also the phone-sized replacement for FilterTabs. */
export function FilterSelect({ path, query, prefix, value, options, className, param = "tab", label = "Filter" }: FilterSelectProps) {
  const router = useRouter();
  return (
    <label className={cn("block w-full", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => router.push(listHref({ path, query, prefix }, { [param]: e.target.value || null }), { scroll: false })}
        className="h-10 w-full rounded-lg border border-border bg-primary-soft/60 px-3 text-sm font-medium text-text outline-none focus:border-primary"
      >
        {options.map((o) => (
          <option key={o.value || "all"} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
