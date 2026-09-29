import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { saveBlockedIp } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listBlockedIps } from "@/modules/admin/queries";
import { formatDateTime } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { requestMeta } from "@/server/security/activity";

export const metadata = { title: "Blocked IP" };

const FIELDS: FieldConfig[] = [
  { name: "ip", label: "IP address", required: true, placeholder: "203.0.113.10" },
  { name: "reason", label: "Reason", span: 2 },
  { name: "isActive", label: "Blocked", type: "switch" },
];

export default async function BlockedIpsPage({ searchParams }: PageProps<"/admin/security/blocked-ips">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.blockedIps);
  const sp = await searchParams;
  const [rows, { ip: myIp }] = await Promise.all([listBlockedIps(), requestMeta()]);
  const editing = rows.find((r) => r.id === param(sp, "edit"));
  const showForm = editing ? permission.canEdit : permission.canCreate;

  return (
    <AdminPage
      title="Blocked IP"
      group="Security"
      subtitle={`Sign-in is refused from blocked addresses.${myIp ? ` Your current IP is ${myIp}.` : ""}`}
      saved={Boolean(param(sp, "saved"))}
    >
      {showForm && (
        <Card title={editing ? `Edit ${editing.ip}` : "Block an IP"}>
          <EntityForm
            fields={FIELDS}
            action={saveBlockedIp}
            id={editing?.id}
            initial={editing ?? { isActive: true }}
            cancelHref={editing ? ADMIN_PATHS.blockedIps : undefined}
          />
        </Card>
      )}

      <Card title="Blocked addresses">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          empty="No blocked IPs."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "IP address", cell: (r) => <code className="text-xs">{r.ip}</code> },
            { header: "Reason", cell: (r) => r.reason ?? "—" },
            {
              header: "Blocked by",
              cell: (r) => (r.blockedBy ? [r.blockedBy.firstName, r.blockedBy.lastName].filter(Boolean).join(" ") : "—"),
            },
            { header: "Date", cell: (r) => formatDateTime(r.createdAt) },
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
      </Card>
    </AdminPage>
  );
}
