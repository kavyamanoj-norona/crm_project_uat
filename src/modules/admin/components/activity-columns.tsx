import type { Column } from "@/components/data/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/dates";

export type ActivityRow = {
  id: string;
  at: Date;
  action: string;
  entity: string | null;
  ip: string | null;
  userAgent: string | null;
  username: string | null;
  user: { firstName: string; lastName: string | null; userCode: string } | null;
};

function tone(action: string) {
  if (action === "login.success") return "success" as const;
  if (action.startsWith("login.") || action === "user.auto-lock") return "danger" as const;
  if (action.endsWith(".deactivate") || action.includes("isLocked.on")) return "warning" as const;
  return "neutral" as const;
}

/** Columns shared by the User Activity page and the user details page. */
export function activityColumns({ showUser }: { showUser: boolean }): Column<ActivityRow>[] {
  return [
    { header: "Time", sort: "at", cell: (r) => formatDateTime(r.at) },
    ...(showUser
      ? [
          {
            header: "User",
            cell: (r: ActivityRow) =>
              r.user ? (
                <span>
                  {[r.user.firstName, r.user.lastName].filter(Boolean).join(" ")}
                  <span className="ml-1 text-xs text-text-muted">{r.user.userCode}</span>
                </span>
              ) : (
                <span className="text-text-muted">{r.username ?? "—"}</span>
              ),
          },
        ]
      : []),
    { header: "Action", sort: "action", cell: (r) => <Badge tone={tone(r.action)}>{r.action}</Badge> },
    { header: "Record", cell: (r) => r.entity ?? "—" },
    { header: "IP", cell: (r) => <code className="text-xs">{r.ip ?? "—"}</code> },
  ];
}
