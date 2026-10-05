import { requireUser } from "@/server/auth/session";
import { getNotificationLogs } from "@/server/settings/queries";
import { formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";

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

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Notifications</h1>
        <p className="text-sm text-text-muted">Choose what you get alerted about.</p>
      </div>

      {/* Notification Preferences */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 font-semibold">Notification Preferences</h2>
        <div className="divide-y divide-border">
          {TOGGLES.map((t) => (
            <div key={t.key} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-text-muted">{t.hint}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked="true"
                className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors"
              >
                <span className="inline-block size-4 translate-x-6 rounded-full bg-white transition-transform" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Notification Logs */}
      <div className="rounded-xl border border-border bg-surface">
        <div className="border-b border-border p-5 pb-0">
          <h2 className="mb-3 font-semibold">Notification Logs</h2>
          <p className="mb-3 text-xs text-text-muted">
            Comprehensive log of all system events and user actions on your account.
          </p>
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto">
            {TABS.map(({ key, label }) => (
              <a
                key={key}
                href={`/settings/notifications${key ? `?tab=${key}` : ""}`}
                className={`shrink-0 rounded-t-lg px-4 py-2 text-sm font-medium ${tab === key ? "bg-primary text-white" : "text-text-muted hover:text-text"}`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>

        <div className="divide-y divide-border">
          {logs.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">No activity logs yet.</p>
          ) : (
            logs.map((log) => {
              const { bg, text } = actionIcon(log.action);
              return (
                <div key={log.id} className="flex items-start gap-3 p-4">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${bg} text-[10px] font-bold text-white`}>
                    {text}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-brand-navy dark:text-text">{actionLabel(log.action)}</span>
                      <Badge tone="neutral">{log.action.split(".")[0]?.toUpperCase()}</Badge>
                      <span className="text-xs text-text-muted">{formatDateTime(log.at)}</span>
                    </div>
                    {log.detail && <p className="mt-0.5 text-sm text-text-muted">{log.detail}</p>}
                    {log.ip && <p className="mt-0.5 text-xs text-text-muted">IP: {log.ip}</p>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
