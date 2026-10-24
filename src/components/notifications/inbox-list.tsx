"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { CategoryTile, categoryMeta, timeAgo, type NotificationItem } from "./notification-meta";

const when = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });

/** Notification cards: unread ones carry a NEW badge and a coloured edge; opening one marks it read. */
export function InboxList({ rows, markRead }: { rows: NotificationItem[]; markRead: (id?: string) => Promise<unknown> }) {
  const router = useRouter();

  if (rows.length === 0)
    return (
      <div className="flex flex-col items-center gap-1 rounded-xl border border-dashed border-border py-8 text-center">
        <BellOff className="size-6 text-text-muted" />
        <p className="text-sm font-medium">No notifications here</p>
        <p className="text-xs text-text-muted">New mentions, approvals and updates will appear in this list.</p>
      </div>
    );

  return (
    <ul className="space-y-2">
      {rows.map((n) => (
        <li key={n.id}>
          <Link
            href={n.url}
            onClick={() => {
              if (!n.read) void markRead(n.id).then(() => router.refresh());
            }}
            className={cn(
              "flex items-start gap-3 rounded-xl border border-border bg-surface p-3 shadow-sm transition-colors hover:bg-surface-muted",
              !n.read && "border-l-4 border-l-primary",
            )}
          >
            <CategoryTile category={n.category} className="size-10 rounded-full" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-semibold text-primary">{n.title}</span>
                {!n.read && <span className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">NEW</span>}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{categoryMeta(n.category).label}</span>
                <span className="text-xs text-text-muted" title={when.format(new Date(n.createdAt))}>
                  • {when.format(new Date(n.createdAt))} ({timeAgo(n.createdAt)})
                </span>
              </span>
              <span className="mt-1 block text-sm">{n.body}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
