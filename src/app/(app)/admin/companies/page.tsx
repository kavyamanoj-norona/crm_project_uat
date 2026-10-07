import { db } from "@/server/db";
import { ActiveBadge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveCompany } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { CompanyTabs } from "@/modules/admin/components/company-tabs";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { COMPANY_SORTS, listCompanies } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Company" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "Enter company code" },
  { name: "name", label: "Company name", required: true, span: 2 },
  { name: "gstin", label: "GSTIN", placeholder: "Enter GSTIN" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone" },
  { name: "address", label: "Address", type: "textarea", span: 2 },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function CompaniesPage({ searchParams }: PageProps<"/admin/companies">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.companies);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.companies, sp, { sorts: COMPANY_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing] = await Promise.all([
    listCompanies(list),
    editId && permission.canEdit ? db.company.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Company"
      saved={param(sp, "saved")}
      nav={<CompanyTabs active="companies" />}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Company",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.companies,
              content: (
                <EntityForm fields={FIELDS} schema="company" action={saveCompany} id={editing?.id} initial={editing ?? { isActive: true }} />
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
        searchPlaceholder="Search name, code or GSTIN…"
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Code", sort: "code", cell: (r) => <span className="font-medium">{r.code}</span> },
          { header: "Name", sort: "name", cell: (r) => r.name },
          { header: "GSTIN", cell: (r) => r.gstin ?? "—" },
          { header: "Phone", cell: (r) => r.phone ?? "—" },
          { header: "Branches", cell: (r) => r._count.branches, align: "center" },
          { header: "Users", cell: (r) => r._count.users, align: "center" },
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
    </AdminPage>
  );
}
