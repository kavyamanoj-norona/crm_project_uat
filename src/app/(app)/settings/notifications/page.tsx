import { requireUser } from "@/server/auth/session";
import { getNotificationLogs } from "@/server/settings/queries";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { BellRing, CheckCheck } from "lucide-react";
import { Button, LinkButton } from "@/components/ui/button";
import { InboxFilters } from "@/components/notifications/inbox-filters";
import { InboxList } from "@/components/notifications/inbox-list";
import { listInbox } from "@/server/notify/inbox";
import { markNotificationsRead } from "@/server/notify-actions";

export const metadata = { title: "Notifications" };

const TOGGLES = [
  { label: "New case assigned to me", hint: "When a case is assigned to you as engineer", key: "case_assigned" },
  { label: "Case status changed", hint: "When a case you created or handled changes stage", key: "case_status" },
  { label: "Payment received", hint: "When a payment is recorded on a case you handled", key: "payment" },
  { label: "New customer created", hint: "When a new customer record is added", key: "customer_new" },
  { label: "Low stock alert", hint: "When a catalog item drops below reorder level", key: "low_stock" },
  { label: "WhatsApp delivery failure", hint: "When a WhatsApp message fails to deliver", key: "wa_fail" },
];

const TABS = [
  { key: "", label: "All logs" },
  { key: "service", label: "Service" },
  { key: "inventory", label: "Inventory" },
  { key: "settings", label: "Settings" },
];

function actionIcon(action: string) {
  if (action.startsWith("case.")) return { bg: "bg-primary", text: "SC" };
  if (action.startsWith("customer.")) return { bg: "bg-green-500", text: "CU" };
  if (action.startsWith("login")) return { bg: "bg-amber-500", text: "LG" };
  if (action.startsWith("user.password")) return { bg: "bg-red-500", text: "PW" };
  if (action.startsWith("user.profile")) return { bg: "bg-violet-500", text: "PR" };
  return { bg: "bg-slate-500", text: action.slice(0, 2).toUpperCase() };
}

function actionLabel(action: string) {
  const labels: Record<string, string> = {
    "login.success": "Signed In",
    "logout": "Signed Out",
    "login.failed": "Failed Login",
    "user.profile.update": "Profile Updated",
    "user.password.change": "Password Changed",
    "case.create": "Case Created",
    "case.status.change": "Case Status Changed",
    "customer.create": "Customer Created",
    "customer.update": "Customer Updated",
  };
  return labels[action] ?? action;
}

export default async function NotificationsPage({ searchParams }: PageProps<"/settings/notifications">) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab = typeof sp?.tab === "string" ? sp.tab : "";
  const logs = await getNotificationLogs(user.id, tab);

  // Your notifications (the bell, in full): filtered by category, status and date.
  const str = (k: string) => (typeof sp?.[k] === "string" ? (sp[k] as string) : "");
  const take = Math.min(200, Math.max(20, Number(str("take")) || 20));
  const status = str("status") === "unread" || str("status") === "read" ? (str("status") as "unread" | "read") : undefined;
  const inbox = await listInbox(user.id, { category: str("cat") || undefined, status, date: str("date") || undefined, take });
  const allCount = Object.values((await listInbox(user.id, { take: 1 })).counts).reduce((a, b) => a + b, 0);
  const moreHref = (() => {
    const q = new URLSearchParams(Object.entries(sp ?? {}).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : [])));
    q.set("take", String(take + 20));
    return `/settings/notifications?${q}`;
  })();

  async function markAllRead() {
    "use server";
    await markNotificationsRead();
  }
  const unread = inbox.rows.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-brand-navy dark:text-text">Notifications</h1>
          <p className="text-sm text-text-muted">Everything you were alerted about, and what you choose to be alerted about.</p>
        </div>
        <form action={markAllRead}>
          <Button type="submit" variant="secondary" size="sm" disabled={unread === 0}>
            <CheckCheck className="size-4" /> Mark all as read
          </Button>
        </form>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Your notifications: the bell, in full */}
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <BellRing className="size-5 text-primary" />
            <h2 className="font-semibold">Notification logs</h2>
            <span className="text-xs text-text-muted">Mentions, approvals, service and inventory updates</span>
          </div>
          <InboxFilters counts={inbox.counts} total={allCount} />
          <div className="mt-4">
            <InboxList rows={inbox.rows} markRead={markNotificationsRead} />
          </div>
          {inbox.total > inbox.rows.length && (
            <div className="mt-4 text-center">
              <LinkButton href={moreHref} variant="secondary" size="sm">
                Show more ({inbox.total - inbox.rows.length} left)
              </LinkButton>
            </div>
          )}
        </section>

        <div className="space-y-5 xl:sticky xl:top-20">
          {/* Notification Preferences */}
          <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
            <h2 className="mb-1 font-semibold">Notification preferences</h2>
            <div className="divide-y divide-border">
              {TOGGLES.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-xs text-text-muted">{t.hint}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked="true"
                    aria-label={t.label}
                    className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full bg-primary transition-colors"
                  >
                    <span className="inline-block size-4 translate-x-6 rounded-full bg-white transition-transform" />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Account activity */}
          <section className="rounded-xl border border-border bg-surface">
            <div className="border-b border-border px-4 pt-4 sm:px-5">
              <h2 className="font-semibold">Account activity</h2>
              <p className="mb-2 text-xs text-text-muted">System events and actions on your account.</p>
              <div className="flex gap-1 overflow-x-auto">
                {TABS.map(({ key, label }) => (
                  <a
                    key={key}
                    href={`/settings/notifications${key ? `?tab=${key}` : ""}`}
                    className={`shrink-0 rounded-t-lg px-3 py-1.5 text-xs font-medium ${tab === key ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
                  >
                    {label}
                  </a>
                ))}
              </div>
            </div>
            <div className="max-h-[28rem] divide-y divide-border overflow-y-auto">
              {logs.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-muted">No activity yet.</p>
              ) : (
                logs.map((log) => {
                  const { bg, text } = actionIcon(log.action);
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bg} text-[10px] font-bold text-white`}>{text}</div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-brand-navy dark:text-text">{actionLabel(log.action)}</span>
                          <Badge tone="neutral">{log.action.split(".")[0]?.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-text-muted">
                          {formatDateTime(log.at)}
                          {log.ip ? ` · IP ${log.ip}` : ""}
                        </p>
                        {log.detail && <p className="mt-0.5 break-words text-sm text-text-muted">{log.detail}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
