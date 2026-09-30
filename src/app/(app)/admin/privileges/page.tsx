import Link from "next/link";
import { KeyRound } from "lucide-react";
import { db } from "@/server/db";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { savePrivilege } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { PRIVILEGE_SORTS, listPrivileges } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

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
  const list = listState(ADMIN_PATHS.privileges, sp, { sorts: PRIVILEGE_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing] = await Promise.all([
    listPrivileges(list),
    editId && permission.canEdit ? db.privilege.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Privilege"
      subtitle="A privilege is a role. Open Permissions to choose which menus it can see and use."
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Privilege",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.privileges,
              content: (
                <EntityForm
                  fields={FIELDS}
                  schema="privilege" action={savePrivilege}
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
          { header: "Code", sort: "code", cell: (r) => <span className="font-medium">{r.code}</span> },
          {
            header: "Name",
            sort: "name",
            cell: (r) => (
              <span className="flex items-center gap-2">
                {r.name}
                {r.isSuperAdmin && <Badge tone="primary">Super admin</Badge>}
              </span>
            ),
          },
          { header: "Scope", cell: (r) => (r.isBranchBound ? "Own branch" : "All branches") },
          { header: "Home", cell: (r) => (r.homePath ? <code className="text-xs">{r.homePath}</code> : "—") },
          { header: "Menus", align: "center", cell: (r) => (r.isSuperAdmin ? "All" : r._count.permissions) },
          { header: "Users", align: "center", cell: (r) => r._count.users },
          { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
          {
            header: "Action",
            cell: (r) => (
              <RowActions
                editHref={permission.canEdit ? `${ADMIN_PATHS.privileges}?edit=${r.id}` : undefined}
                toggle={permission.canEdit ? toggleActive.bind(null, "privilege", r.id) : undefined}
                active={r.isActive}
              >
                <Link
                  href={`${ADMIN_PATHS.privileges}/${r.id}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary-soft"
                >
                  <KeyRound className="size-3.5" /> Permissions
                </Link>
              </RowActions>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
