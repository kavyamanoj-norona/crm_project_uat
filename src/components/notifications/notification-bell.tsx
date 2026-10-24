"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, Bell, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { useDismiss } from "@/hooks/use-dismiss";
import { CategoryTile, NOTIFICATION_CATEGORIES, timeAgo, type NotificationItem } from "./notification-meta";
import { PushToggle } from "./push-toggle";
import type { RegisterDevice } from "./push-client";

type Props = {
  count: number;
  items: NotificationItem[];
  markRead: (id?: string) => Promise<unknown>;
  archive: (id: string) => Promise<unknown>;
  registerDevice: RegisterDevice;
  buttonClass: string;
};

/** Bell with a red dot while anything is unread; the menu lists alerts by category, newest first. */
export function NotificationBell({ count, items, markRead, archive, registerDevice, buttonClass }: Props) {
  const { open, setOpen, ref } = useDismiss();
  const router = useRouter();
  const [tab, setTab] = useState("");
  const [, start] = useTransition();

  // New alerts show up without a manual refresh.
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && router.refresh(), 45000);
    return () => clearInterval(t);
  }, [router]);

  const shown = tab ? items.filter((n) => n.category === tab) : items;
  const countOf = (key: string) => (key ? items.filter((n) => n.category === key).length : items.length);
  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className={cn(buttonClass, "relative")}
        aria-label={count ? `Notifications, ${count} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Bell className="size-5" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-surface bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-x-2 top-16 z-50 flex max-h-[calc(100vh-5rem)] flex-col rounded-xl border border-border bg-surface shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[390px]">
          <div className="flex items-center justify-between gap-2 px-4 pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Notifications
              {count > 0 && <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[11px] font-bold text-primary">{count > 99 ? "99+" : count}</span>}
            </p>
            <Link
              href="/settings/notifications"
              onClick={() => setOpen(false)}
              aria-label="Open all notifications"
              title="Open all notifications"
              className="rounded-md p-1 text-text-muted hover:bg-surface-muted hover:text-text"
            >
              <ExternalLink className="size-4" />
            </Link>
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-border px-4 pt-2" role="tablist">
            {[{ key: "", label: "All" }, ...NOTIFICATION_CATEGORIES].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-2 pb-2 text-xs font-medium",
                  tab === t.key ? "border-primary text-primary" : "border-transparent text-text-muted hover:text-text",
                )}
              >
                {t.label} ({countOf(t.key)})
              </button>
            ))}
          </div>

          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
            {shown.length === 0 && <li className="py-10 text-center text-sm text-text-muted">You&apos;re all caught up.</li>}
            {shown.map((n) => (
              <li key={n.id} className={cn("group relative rounded-lg", !n.read && "bg-primary-soft/60")}>
                <Link
                  href={n.url}
                  onClick={() => {
                    setOpen(false);
                    if (!n.read) act(() => markRead(n.id));
                  }}
                  className="flex items-start gap-3 rounded-lg p-2 pr-9 hover:bg-surface-muted"
                >
                  <CategoryTile category={n.category} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <span className="truncate">{n.title}</span>
                      {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </span>
                    <span className="block truncate text-xs text-text-muted">{n.body}</span>
                    <span className="block text-[11px] text-text-muted">{timeAgo(n.createdAt)}</span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={() => act(() => archive(n.id))}
                  aria-label="Archive notification"
                  title="Archive"
                  className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-md p-1.5 text-text-muted hover:bg-surface hover:text-text group-focus-within:block group-hover:block"
                >
                  <Archive className="size-4" />
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            disabled={count === 0}
            onClick={() => act(() => markRead())}
            className="border-t border-border bg-surface-muted px-4 py-2.5 text-sm font-medium hover:bg-primary-soft disabled:opacity-50"
          >
            Mark all as read
          </button>
          <div className="rounded-b-xl px-4 pb-3">
            <PushToggle register={registerDevice} />
          </div>
        </div>
      )}
    </div>
  );
}
