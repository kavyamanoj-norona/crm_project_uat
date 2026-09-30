"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";

type CreatePanelProps = {
  /** Button label, e.g. "Add User". */
  label: string;
  /** Editing a record: panel starts open and the button closes the edit. */
  editing?: boolean;
  /** Where "close" goes while editing (the list without ?edit). */
  cancelHref?: string;
  /** Rendered in the header row next to the title. */
  header: React.ReactNode;
  /** Rendered between the header and the panel (e.g. section tabs). */
  between?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Page header with an "+ Add …" button that expands the create form below it.
 * Closed by default; opens automatically when editing a record.
 */
export function CreatePanel({ label, editing = false, cancelHref, header, between, children }: CreatePanelProps) {
  const [open, setOpen] = useState(editing);
  const isOpen = editing || open;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">{header}</div>
        {editing && cancelHref ? (
          <Link href={cancelHref} className={buttonClass("secondary")}>
            <X className="size-4" /> Close edit
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={isOpen}
            aria-controls="create-panel"
            className={buttonClass("secondary")}
          >
            {isOpen ? <Minus className="size-4" /> : <Plus className="size-4" />}
            {label}
          </button>
        )}
      </div>

      {between && <div className="mb-4">{between}</div>}

      {/* grid-rows trick animates height without measuring */}
      <div
        id="create-panel"
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out",
          isOpen ? "mb-6 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!isOpen}
      >
        <div className="overflow-hidden">
          <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">{children}</div>
        </div>
      </div>
    </>
  );
}
