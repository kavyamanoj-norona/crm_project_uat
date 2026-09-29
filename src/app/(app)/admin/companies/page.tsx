import { Card } from "@/components/ui/card";
import { ActiveBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { saveCompany } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listCompanies } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Company" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "NTL" },
  { name: "name", label: "Company name", required: true, span: 2 },
  { name: "gstin", label: "GSTIN", placeholder: "32ABCDE1234F1Z5" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address", type: "textarea", span: 2 },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function CompaniesPage({ searchParams }: PageProps<"/admin/companies">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.companies);
  const sp = await searchParams;
  const rows = await listCompanies();
  const editing = rows.find((r) => r.id === param(sp, "edit"));
  const showForm = editing ? permission.canEdit : permission.canCreate;

  return (
    <AdminPage title="Company" saved={Boolean(param(sp, "saved"))}>
      {showForm && (
        <Card title={editing ? `Edit ${editing.name}` : "Add company"}>
          <EntityForm
            fields={FIELDS}
            action={saveCompany}
            id={editing?.id}
            initial={editing ?? { isActive: true }}
            cancelHref={editing ? ADMIN_PATHS.companies : undefined}
          />
        </Card>
      )}

      <Card title="Companies">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          highlight={(r) => r.id === editing?.id}
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
            { header: "Name", cell: (r) => r.name },
            { header: "GSTIN", cell: (r) => r.gstin ?? "—" },
            { header: "Phone", cell: (r) => r.phone ?? "—" },
            { header: "Branches", cell: (r) => r._count.branches },
            { header: "Users", cell: (r) => r._count.users },
            { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
            {
              header: "Action",
              cell: (r) =>
                permission.canEdit && (
                  <RowActions
                    editHref={`${ADMIN_PATHS.companies}?edit=${r.id}`}
                    toggle={toggleActive.bind(null, "company", r.id)}
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
