"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export function PeriodTabs() {
  const router = useRouter();
  const sp = useSearchParams();
  const week = Number(sp.get("week") ?? "0");

  function go(w: number) {
    const p = new URLSearchParams(sp.toString());
    p.set("week", String(w));
    router.push(`?${p.toString()}`);
  }

  return (
    <div className="flex rounded-lg border border-border bg-surface overflow-hidden text-sm">
      {[
        { label: "This week", value: 0 },
        { label: "vs Last week", value: 1 },
      ].map(({ label, value }) => (
        <button
          key={value}
          type="button"
          onClick={() => go(value)}
          className={cn(
            "px-4 py-2 font-medium transition-colors",
            week === value
              ? "bg-primary text-white"
              : "text-text-muted hover:bg-surface hover:text-text",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
