"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = { id: number; type: ToastType; title?: string; message: string };

type ToastOptions = { title?: string; duration?: number };

// ─── Store (module-level, so toast() works from any client component) ────────

const MAX_VISIBLE = 3; // blueprint §5: bottom-right, max 3 stacked
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  for (const l of listeners) l();
}

function dismiss(id: number) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  items = items.filter((t) => t.id !== id);
  emit();
}

function show(type: ToastType, message: string, opts: ToastOptions = {}) {
  // Same message already visible → don't stack duplicates.
  if (items.some((t) => t.type === type && t.message === message)) return;
  const id = nextId++;
  items = [...items, { id, type, message, title: opts.title }].slice(-MAX_VISIBLE);
  emit();
  const duration = opts.duration ?? (type === "error" ? 6000 : 4000);
  timers.set(id, setTimeout(() => dismiss(id), duration));
  return id;
}

/**
 * Show a toast from any client component:
 *   toast.success("User saved")   toast.error("Mobile is required")
 *   toast.info("Showing Edappally")   toast.warning("Session ends in 5 min")
 */
export const toast = Object.assign((message: string, type: ToastType = "info", opts?: ToastOptions) => show(type, message, opts), {
  success: (message: string, opts?: ToastOptions) => show("success", message, opts),
  error: (message: string, opts?: ToastOptions) => show("error", message, opts),
  info: (message: string, opts?: ToastOptions) => show("info", message, opts),
  warning: (message: string, opts?: ToastOptions) => show("warning", message, opts),
  dismiss,
});

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// ─── View ────────────────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { Icon: typeof Info; accent: string; title: string }> = {
  success: { Icon: CircleCheck, accent: "text-success bg-success/12", title: "Success" },
  error: { Icon: CircleAlert, accent: "text-danger bg-danger/12", title: "Error" },
  info: { Icon: Info, accent: "text-primary bg-primary-soft", title: "Info" },
  warning: { Icon: TriangleAlert, accent: "text-warning bg-warning/12", title: "Warning" },
};

const BAR: Record<ToastType, string> = {
  success: "bg-success",
  error: "bg-danger",
  info: "bg-primary",
  warning: "bg-warning",
};

/** Mount once in the root layout. */
export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => items, () => items);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {list.map((t) => (
        <ToastCard key={t.id} item={t} />
      ))}
    </div>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);
  const { Icon, accent, title } = STYLES[item.type];

  return (
    <div
      role={item.type === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-xl border border-border bg-surface p-3.5 pr-10 shadow-lg transition-all duration-300 motion-reduce:transition-none",
        shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", BAR[item.type])} aria-hidden />
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", accent)}>
        <Icon className="size-4.5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-sm font-semibold text-text">{item.title ?? title}</p>
        <p className="mt-0.5 text-sm break-words text-text-muted">{item.message}</p>
      </div>
      <button
        type="button"
        onClick={() => dismiss(item.id)}
        aria-label="Dismiss"
        className="absolute top-2.5 right-2.5 rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
