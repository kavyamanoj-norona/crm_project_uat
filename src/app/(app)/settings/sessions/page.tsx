import { Monitor, Smartphone } from "lucide-react";
import { requireUser } from "@/server/auth/session";
import { getSessionHistory } from "@/server/settings/queries";
import { formatDateTime } from "@/lib/dates";
import { logout } from "@/server/auth/actions";

export const metadata = { title: "Sessions" };

function parseDevice(ua: string | null) {
  if (!ua) return { device: "Unknown Device", type: "desktop" as const };
  const isPhone = /android|iphone|ipad|mobile/i.test(ua);
  const browser = ua.match(/Chrome\/|Firefox\/|Safari\/|Edge\/|OPR\//)?.[0]?.replace("/", "") ?? "Browser";
  const os = ua.match(/Windows|Mac OS|Linux|Android|iOS|iPhone/)?.[0] ?? "Unknown OS";
  return {
    device: `${os} · ${browser}`,
    type: isPhone ? ("mobile" as const) : ("desktop" as const),
  };
}

export default async function SessionsPage() {
  const user = await requireUser();
  const history = await getSessionHistory(user.id);

  const logins = history.filter((h) => h.action === "login.success");
  const [current, ...others] = logins;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-bold text-brand-navy dark:text-text">Sessions</h1>
        <p className="text-sm text-text-muted">List of active sessions. You can terminate them by clicking on the remove button.</p>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h2 className="font-semibold">Active Sessions</h2>
            <p className="text-sm text-text-muted">List of active sessions. You can terminate them by clicking on the remove button.</p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/20 dark:text-red-400"
            >
              Sign out all other devices
            </button>
          </form>
        </div>

        {/* Current device */}
        {current && (
          <>
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">This Device</p>
            </div>
            <div className="mx-5 mb-4 flex items-center gap-4 rounded-xl border border-border p-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                <Monitor className="size-5" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">{parseDevice(current.userAgent).device}</p>
                <p className="text-xs text-text-muted">
                  {current.ip ?? "—"} · <span className="text-green-600 dark:text-green-400">Active Now</span>
                </p>
              </div>
              <form action={logout}>
                <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted flex items-center gap-1.5">
                  <span className="text-text-muted">↗</span> Log Out
                </button>
              </form>
            </div>
          </>
        )}

        {/* Other devices */}
        {others.length > 0 && (
          <>
            <div className="px-5 pb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Other Devices</p>
            </div>
            <div className="divide-y divide-border px-5 pb-5">
              {others.map((session) => {
                const { device, type } = parseDevice(session.userAgent);
                return (
                  <div key={session.id} className="flex items-center gap-4 py-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pink-500 text-white">
                      {type === "mobile" ? <Smartphone className="size-5" /> : <Monitor className="size-5" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{device}</p>
                      <p className="text-xs text-text-muted">
                        {session.ip ?? "—"} · Last Active: {formatDateTime(session.at)}
                      </p>
                    </div>
                    <span className="text-xs text-text-muted italic">
                      Terminate unavailable
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {logins.length === 0 && (
          <p className="py-8 text-center text-sm text-text-muted">No session history found.</p>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-4 font-semibold">Sign-in History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-text-muted">No history yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {history.slice(0, 10).map((h) => (
              <div key={h.id} className="flex items-center justify-between py-2.5 text-sm">
                <div>
                  <span className={`font-medium ${h.action === "login.success" ? "text-green-600 dark:text-green-400" : "text-text-muted"}`}>
                    {h.action === "login.success" ? "Signed in" : "Signed out"}
                  </span>
                  <span className="ml-2 text-xs text-text-muted">{h.ip ?? "—"}</span>
                </div>
                <span className="text-xs text-text-muted">{formatDateTime(h.at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
