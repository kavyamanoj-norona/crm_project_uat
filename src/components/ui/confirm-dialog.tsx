"use client";

import { useEffect, useRef } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

/** "Are you sure?" popup on the native <dialog> (focus trap + Esc built in). */
export function ConfirmDialog({ open, message, confirmLabel = "Delete", onConfirm, onCancel }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => e.target === ref.current && onCancel()}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-border bg-surface p-0 text-text shadow-xl backdrop:bg-brand-navy/40 backdrop:backdrop-blur-[2px]"
    >
      {open && (
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <TriangleAlert className="size-16 text-warning" strokeWidth={1.75} />
          <h2 id="confirm-title" className="mt-4 text-xl font-medium">
            Are you sure?
          </h2>
          <p className="mt-2 text-sm text-text-muted">{message}</p>
          <div className="mt-8 flex gap-3">
            <Button variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button variant="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
