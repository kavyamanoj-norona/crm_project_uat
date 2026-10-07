"use client";

import { useEffect, useState } from "react";
import { AlignJustify, List, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/cn";

type TableCardProps = {
  /** Left side of the toolbar: filter tabs, search box … */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

const toolBtn =
  "inline-flex size-7 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-surface hover:text-text";

/**
 * Single unified container for a list: toolbar at the top (with border-b
 * separator), DataTable flush to the edges, and Pagination at the bottom
 * (with border-t separator). All inside one rounded bordered card.
 */
export function TableCard({ toolbar, children, className }: TableCardProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFullscreen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [fullscreen]);

  return (
    <section
      data-density={compact ? "compact" : "comfortable"}
      className={cn(
        "group/table overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        fullscreen && "fixed inset-0 z-50 overflow-auto rounded-none border-0 p-0",
        className,
      )}
    >
      {/* Toolbar — padded, separated from table by a border-b */}
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 basis-full flex-col gap-3 sm:basis-0 sm:flex-row sm:items-center [&>label]:sm:shrink-0">
          {toolbar}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1 rounded-lg bg-surface-muted p-1">
          <button
            type="button"
            className={toolBtn}
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? "Exit full screen" : "Full screen"}
            title={fullscreen ? "Exit full screen (Esc)" : "Full screen"}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            type="button"
            className={cn(toolBtn, compact && "bg-surface text-text shadow-sm")}
            onClick={() => setCompact((c) => !c)}
            aria-pressed={compact}
            aria-label="Compact rows"
            title={compact ? "Comfortable rows" : "Compact rows"}
          >
            {compact ? <AlignJustify className="size-4" /> : <List className="size-4" />}
          </button>
        </div>
      </div>

      {/* DataTable + Pagination — flush to card edges; overflow-hidden on section clips rounded corners */}
      {children}
    </section>
  );
}
