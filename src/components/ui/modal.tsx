"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const sizes: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Icon shown before the title. */
  icon?: React.ReactNode;
  size?: ModalSize;
  /** Pinned under the scrolling body, e.g. action buttons. */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/**
 * Accessible dialog on the native <dialog> element (focus trap + Esc built in).
 * Long content scrolls inside the body; header and footer stay put.
 * Children only mount while open, so forms inside start fresh each time.
 */
export function Modal({ open, onClose, title, description, icon, size = "sm", footer, className, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()} // click on backdrop
      aria-labelledby={titleId}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-brand-navy/40 backdrop:backdrop-blur-[2px]",
        sizes[size],
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              {icon && <span className="mt-0.5 text-primary">{icon}</span>}
              <div>
                <h2 id={titleId} className="text-lg font-semibold">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-border px-4 py-3 sm:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
