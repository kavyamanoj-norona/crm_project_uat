import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveBlockedIp } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { BLOCKED_IP_SORTS, listBlockedIps } from "@/modules/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { requestMeta } from "@/server/security/activity";

export const metadata = { title: "Block List" };

const FIELDS: FieldConfig[] = [
  { name: "ip", label: "IP address", required: true, placeholder: "Enter IP address" },
  { name: "reason", label: "Reason", span: 2 },
  { name: "isActive", label: "Blocked", type: "switch" },
];

export default async function BlockedIpsPage({ searchParams }: PageProps<"/admin/security/blocked-ips">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.blockedIps);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.blockedIps, sp, { sorts: BLOCKED_IP_SORTS, defaultSort: "createdAt" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing, { ip: myIp }] = await Promise.all([
    listBlockedIps(list),
    editId && permission.canEdit ? db.blockedIp.findUnique({ where: { id: editId } }) : null,
    requestMeta(),
  ]);

  return (
    <AdminPage
      title="Block List"
      group="Security"
      subtitle={`Sign-in is refused from blocked addresses.${myIp ? ` Your current IP is ${myIp}.` : ""}`}
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Block IP",
              editingTitle: editing?.ip,
              cancelHref: ADMIN_PATHS.blockedIps,
              content: (
                <EntityForm fields={FIELDS} schema="blockedIp" action={saveBlockedIp} id={editing?.id} initial={editing ?? { isActive: true }} />
              ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search IP or reason…"
        empty="No blocked IPs."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "IP address", sort: "ip", cell: (r) => <code className="text-xs">{r.ip}</code> },
          { header: "Reason", cell: (r) => r.reason ?? "—" },
          {
            header: "Blocked by",
            cell: (r) => (r.blockedBy ? [r.blockedBy.firstName, r.blockedBy.lastName].filter(Boolean).join(" ") : "—"),
          },
          { header: "Date", sort: "createdAt", cell: (r) => formatDateTime(r.createdAt) },
          {
            header: "Status",
            cell: (r) => <Badge tone={r.isActive ? "danger" : "neutral"}>{r.isActive ? "Blocked" : "Unblocked"}</Badge>,
          },
          {
            header: "Action",
            cell: (r) =>
              permission.canEdit && (
                <RowActions
                  editHref={`${ADMIN_PATHS.blockedIps}?edit=${r.id}`}
                  toggle={toggleActive.bind(null, "blockedIp", r.id)}
                  active={r.isActive}
                />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
