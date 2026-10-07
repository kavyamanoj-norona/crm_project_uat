import { db } from "@/server/db";
import { ActiveBadge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveDepartment } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { CompanyTabs } from "@/modules/admin/components/company-tabs";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { DEPARTMENT_SORTS, listDepartments, listDomainOptions } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: PageProps<"/admin/companies/departments">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.departments);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.departments, sp, { sorts: DEPARTMENT_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing, domains] = await Promise.all([
    listDepartments(list),
    editId && permission.canEdit ? db.department.findUnique({ where: { id: editId } }) : null,
    listDomainOptions(),
  ]);

  const fields: FieldConfig[] = [
    {
      name: "domainId",
      label: "Domain",
      type: "select",
      required: true,
      options: domains.map((d) => ({ value: d.id, label: d.name })),
    },
    { name: "name", label: "Department name", required: true, placeholder: "Enter department name" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  return (
    <AdminPage
      title="Company"
      saved={param(sp, "saved")}
      nav={<CompanyTabs active="departments" />}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Department",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.departments,
              content:
                domains.length === 0 ? (
                  <p className="text-sm text-text-muted">Create a domain first.</p>
                ) : (
                  <EntityForm
                    fields={fields}
                    schema="department"
                    action={saveDepartment}
                    id={editing?.id}
                    initial={editing ?? { isActive: true, domainId: list.tab || domains[0]?.id }}
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
        searchPlaceholder="Search department…"
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Department", sort: "name", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Domain", sort: "domain", cell: (r) => r.domain.name },
          { header: "Users", cell: (r) => r._count.users, align: "center" },
          { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
          {
            header: "Action",
            cell: (r) =>
              permission.canEdit && (
                <RowActions
                  editHref={`${ADMIN_PATHS.departments}?edit=${r.id}`}
                  toggle={toggleActive.bind(null, "department", r.id)}
                  active={r.isActive}
                />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
