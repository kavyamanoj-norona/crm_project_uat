import { Card } from "@/components/ui/card";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { saveBranch } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listBranches, selectOptions } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Branch" };

export default async function BranchesPage({ searchParams }: PageProps<"/admin/branches">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.branches);
  const sp = await searchParams;
  const [rows, options] = await Promise.all([listBranches(), selectOptions()]);
  const editing = rows.find((r) => r.id === param(sp, "edit"));
  const showForm = editing ? permission.canEdit : permission.canCreate;

  const fields: FieldConfig[] = [
    {
      name: "companyId",
      label: "Company",
      type: "select",
      required: true,
      options: options.companies.map((c) => ({ value: c.id, label: c.name })),
    },
    { name: "code", label: "Branch code", required: true, placeholder: "EDP", hint: "Used in jobsheet numbers" },
    { name: "name", label: "Branch name", required: true, placeholder: "Edappally" },
    { name: "phone", label: "Phone" },
    { name: "address", label: "Address", type: "textarea", span: 2 },
    { name: "isVirtual", label: "Virtual branch (e.g. lab)", type: "switch" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  return (
    <AdminPage title="Branch" saved={Boolean(param(sp, "saved"))}>
      {showForm && (
        <Card title={editing ? `Edit ${editing.name}` : "Add branch"}>
          {options.companies.length === 0 ? (
            <p className="text-sm text-text-muted">Create a company first.</p>
          ) : (
            <EntityForm
              fields={fields}
              action={saveBranch}
              id={editing?.id}
              initial={editing ?? { isActive: true, companyId: options.companies[0]?.id }}
              cancelHref={editing ? ADMIN_PATHS.branches : undefined}
            />
          )}
        </Card>
      )}

      <Card title="Branches">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          highlight={(r) => r.id === editing?.id}
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
            {
              header: "Name",
              cell: (r) => (
                <span className="flex items-center gap-2">
                  {r.name}
                  {r.isVirtual && <Badge tone="primary">Virtual</Badge>}
                </span>
              ),
            },
            { header: "Company", cell: (r) => r.company.name },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
            { header: "Users", cell: (r) => r._count.users },
            { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
            {
              header: "Action",
              cell: (r) =>
                permission.canEdit && (
                  <RowActions
                    editHref={`${ADMIN_PATHS.branches}?edit=${r.id}`}
                    toggle={toggleActive.bind(null, "branch", r.id)}
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
