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
 * Card around a list: toolbar (tabs + search) on the left, fullscreen and
 * row-density toggles on the right. Children: DataTable + Pagination.
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
        "group/table rounded-xl border border-border bg-surface p-4 shadow-sm",
        fullscreen && "fixed inset-0 z-50 overflow-auto rounded-none border-0 p-6",
        className,
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* tabs shrink and scroll; search keeps its width; icons stay right */}
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
      {children}
    </section>
  );
}
