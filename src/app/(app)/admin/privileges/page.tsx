import { db } from "@/server/db";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { savePrivilege } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { PrivilegeActionsCell } from "@/modules/admin/components/privilege-actions-cell";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { PRIVILEGE_SORTS, listPrivileges } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";
import { formatDate } from "@/lib/dates";

export const metadata = { title: "Privilege" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "CAMPAIGN_MANAGER" },
  { name: "name", label: "Privilege name", required: true, placeholder: "Campaign Manager" },
  { name: "homePath", label: "Home page", placeholder: "/service/dashboard", hint: "Where users land after login" },
  { name: "description", label: "Description" },
  { name: "isBranchBound", label: "Own branch only", type: "switch" },
  { name: "isSuperAdmin", label: "Super admin (sees everything)", type: "switch", span: 2 },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function PrivilegesPage({ searchParams }: PageProps<"/admin/privileges">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.privileges);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.privileges, sp, { sorts: PRIVILEGE_SORTS, defaultSort: "createdAt", defaultDir: "desc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing] = await Promise.all([
    listPrivileges(list),
    editId && permission.canEdit ? db.privilege.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Privilege"
      subtitle="A privilege is a role. Click the key icon to manage which modules it can access."
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "New Privilege",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.privileges,
              content: (
                <EntityForm
                  fields={FIELDS}
                  schema="privilege"
                  action={savePrivilege}
                  id={editing?.id}
                  initial={editing ?? { isActive: true, isBranchBound: true }}
                />
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
        searchPlaceholder="Search privilege…"
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Date",
            sort: "createdAt",
            cell: (r) => <span className="text-xs text-text-muted">{formatDate(r.createdAt)}</span>,
          },
          {
            header: "Name",
            sort: "name",
            cell: (r) => (
              <span className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                {r.isSuperAdmin && <Badge tone="primary">Super admin</Badge>}
              </span>
            ),
          },
          {
            header: "Code",
            sort: "code",
            cell: (r) => (
              <span className="inline-flex items-center rounded border border-border px-2 py-0.5 font-mono text-[11px] font-semibold text-text">
                {r.code}
              </span>
            ),
          },
          {
            header: "Actions",
            cell: (r) => (
              <PrivilegeActionsCell
                privilegeId={r.id}
                privilegeName={r.name}
                isSuperAdmin={r.isSuperAdmin}
                editHref={permission.canEdit ? `${ADMIN_PATHS.privileges}?edit=${r.id}` : undefined}
                toggle={permission.canEdit ? toggleActive.bind(null, "privilege", r.id) : undefined}
                active={r.isActive}
                canEdit={permission.canEdit}
                permissionsHref={`${ADMIN_PATHS.privileges}/${r.id}`}
              />
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
