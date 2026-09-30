import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { activityColumns } from "@/modules/admin/components/activity-columns";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { ACTIVITY_SORTS, listActivity } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";
import { branchWhere, getBranchScope } from "@/server/branch-scope";

export const metadata = { title: "User Activity" };

export default async function ActivityLogPage({ searchParams }: PageProps<"/admin/security/activity-log">) {
  const { user } = await requirePageAccess(ADMIN_PATHS.activityLog);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.activityLog, sp, { sorts: ACTIVITY_SORTS, defaultSort: "at", defaultPageSize: 50 });
  const { rows, total, tabs } = await listActivity(list, undefined, branchWhere(scope));

  return (
    <AdminPage title="User Activity" group="Security" subtitle={`Sign-ins, sign-outs, lockouts and Master Settings changes — ${scope.branch ? `users of ${scope.branch.name}` : "all branches"}.`}>
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search user, action or IP…"
        empty="No activity yet."
        columns={[
          ...activityColumns({ showUser: true }),
          {
            header: "Device",
            cell: (r) => <span className="block max-w-72 truncate text-xs text-text-muted">{r.userAgent ?? "—"}</span>,
          },
        ]}
      />
    </AdminPage>
  );
}
