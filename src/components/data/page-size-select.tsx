"use client";

import { useRouter } from "next/navigation";
import { listHref, PAGE_SIZES } from "@/lib/list";

type PageSizeSelectProps = {
  path: string;
  query: Record<string, string>;
  prefix: string;
  value: number;
};

/** "Show [50] entries" — changes the page size and goes back to page 1. */
export function PageSizeSelect({ path, query, prefix, value }: PageSizeSelectProps) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-text-muted">
      Show
      <select
        value={value}
        onChange={(e) => router.push(listHref({ path, query, prefix }, { size: e.target.value }), { scroll: false })}
        className="h-8 rounded-full border border-border bg-surface px-3 text-sm text-text outline-none focus:border-primary"
      >
        {PAGE_SIZES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      entries
    </label>
  );
}
