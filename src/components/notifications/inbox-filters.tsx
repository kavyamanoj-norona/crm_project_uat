"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { Input, Select } from "@/components/ui/field";
import { NOTIFICATION_CATEGORIES } from "./notification-meta";

const BASE = "/settings/notifications";

/** Category tabs plus Status and Date filters for the notifications page. Everything lives in the URL. */
export function InboxFilters({ counts, total }: { counts: Record<string, number>; total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const cat = params.get("cat") ?? "";
  const status = params.get("status") ?? "";
  const date = params.get("date") ?? "";

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    next.delete("take");
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.push(`${BASE}${next.size ? `?${next}` : ""}`);
  };

  return (
    <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1" role="tablist">
        {[{ key: "", label: "All logs", count: total }, ...NOTIFICATION_CATEGORIES.map((c) => ({ ...c, count: counts[c.key] ?? 0 }))].map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={cat === t.key}
            onClick={() => go({ cat: t.key })}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium",
              cat === t.key ? "bg-surface text-primary shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            {t.label} <span className="text-xs">({t.count})</span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Status"
          value={status}
          onChange={(e) => go({ status: e.target.value })}
          placeholder="Status"
          options={[
            { value: "unread", label: "Unread" },
            { value: "read", label: "Read" },
          ]}
          className="w-32"
        />
        <Input aria-label="Date" type="date" value={date} onChange={(e) => go({ date: e.target.value })} className="w-40" />
        {(cat || status || date) && (
          <button type="button" onClick={() => router.push(BASE)} className="h-10 rounded-lg bg-surface-muted px-3 text-sm font-medium hover:bg-primary-soft">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
