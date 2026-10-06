import { ListView } from "@/components/data/list-view";
import { Badge } from "@/components/ui/badge";
import { listState } from "@/lib/list";
import { formatDateTime } from "@/lib/dates";
import { ACTIVITY_SORTS, listActivity } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope, branchWhere } from "@/server/branch-scope";

export const metadata = { title: "Audit Log" };

type Tone = "neutral" | "success" | "danger" | "warning" | "primary" | "navy" | "violet" | "indigo";

function actionTone(action: string): Tone {
  if (action.startsWith("login.failed") || action.startsWith("login.locked") || action.startsWith("login.blocked") || action.startsWith("login.disabled")) return "danger";
  if (action === "login.success" || action === "logout") return "neutral";
  if (action.endsWith(".create") || action.endsWith(".activate")) return "success";
  if (action.endsWith(".deactivate") || action.endsWith(".delete")) return "danger";
  if (action.endsWith(".update") || action.endsWith(".permissions") || action.endsWith(".module-access")) return "indigo";
  if (action.includes("password") || action.includes("reveal")) return "warning";
  if (action.includes("stage") || action.includes("estimate") || action.includes("feedback")) return "primary";
  return "neutral";
}

function actionLabel(action: string): string {
  return action
    .replace(/\./g, " · ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function actorName(row: {
  user: { firstName: string; lastName: string | null; userCode: string } | null;
  username: string | null;
}): string {
  if (row.user) {
    const name = [row.user.firstName, row.user.lastName].filter(Boolean).join(" ");
    return `${name} (${row.user.userCode})`;
  }
  return row.username ?? "System";
}

export default async function AuditLogPage({ searchParams }: PageProps<"/company/audit-log">) {
  const { user } = await requirePageAccess("/company/audit-log");
  const sp = await searchParams;
  const list = listState("/company/audit-log", sp, {
    sorts: ACTIVITY_SORTS,
    defaultSort: "at",
    defaultDir: "desc",
    defaultPageSize: 50,
  });
  const scope = await getBranchScope(user);
  const { rows, total, tabs } = await listActivity(list, undefined, branchWhere(scope));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-text">Audit log</h1>
        <p className="mt-0.5 text-sm text-text-muted">
          Immutable, append-only — who, what, when, old → new. No delete action exists anywhere in the system.
        </p>
      </div>

      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by user, action, IP…"
        empty="No activity yet."
        columns={[
          {
            header: "When",
            sort: "at",
            cell: (r) => (
              <span className="whitespace-nowrap text-sm text-text-muted">
                {formatDateTime(r.at)}
              </span>
            ),
          },
          {
            header: "Who",
            cell: (r) => (
              <span className="text-sm font-medium text-text">{actorName(r)}</span>
            ),
          },
          {
            header: "Event",
            sort: "action",
            cell: (r) => (
              <Badge tone={actionTone(r.action)}>{actionLabel(r.action)}</Badge>
            ),
          },
          {
            header: "Detail",
            cell: (r) => (
              <span className="text-sm text-text-muted">
                {[r.detail, r.entity && r.entityId ? `${r.entity} #${r.entityId}` : r.entity]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            ),
          },
          {
            header: "IP",
            cell: (r) => (
              <span className="font-mono text-xs text-text-muted">{r.ip ?? "—"}</span>
            ),
          },
        ]}
      />
    </div>
  );
}
