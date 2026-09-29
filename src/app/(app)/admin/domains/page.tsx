import { Card } from "@/components/ui/card";
import { ActiveBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { saveDepartment, saveDomain } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listDomains } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Domain" };

const DOMAIN_FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "SALES" },
  { name: "name", label: "Domain name", required: true, placeholder: "Sales" },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function DomainsPage({ searchParams }: PageProps<"/admin/domains">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.domains);
  const sp = await searchParams;
  const domains = await listDomains();

  const editingDomain = domains.find((d) => d.id === param(sp, "edit"));
  const departments = domains.flatMap((d) => d.departments.map((dep) => ({ ...dep, domainName: d.name })));
  const editingDept = departments.find((d) => d.id === param(sp, "editDept"));

  const deptFields: FieldConfig[] = [
    {
      name: "domainId",
      label: "Domain",
      type: "select",
      required: true,
      options: domains.filter((d) => d.isActive).map((d) => ({ value: d.id, label: d.name })),
    },
    { name: "name", label: "Department name", required: true, placeholder: "Sales Team" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  const canWrite = (editing: unknown) => (editing ? permission.canEdit : permission.canCreate);

  return (
    <AdminPage
      title="Domain"
      subtitle="Domains group departments; every user belongs to one department."
      saved={Boolean(param(sp, "saved"))}
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {canWrite(editingDomain) && (
          <Card title={editingDomain ? `Edit ${editingDomain.name}` : "Add domain"}>
            <EntityForm
              fields={DOMAIN_FIELDS}
              action={saveDomain}
              id={editingDomain?.id}
              initial={editingDomain ?? { isActive: true }}
              cancelHref={editingDomain ? ADMIN_PATHS.domains : undefined}
            />
          </Card>
        )}
        {canWrite(editingDept) && (
          <Card title={editingDept ? `Edit ${editingDept.name}` : "Add department"}>
            {domains.length === 0 ? (
              <p className="text-sm text-text-muted">Create a domain first.</p>
            ) : (
              <EntityForm
                fields={deptFields}
                action={saveDepartment}
                id={editingDept?.id}
                initial={editingDept ?? { isActive: true, domainId: domains[0]?.id }}
                cancelHref={editingDept ? ADMIN_PATHS.domains : undefined}
              />
            )}
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Domains">
          <DataTable
            rows={domains}
            rowKey={(r) => r.id}
            highlight={(r) => r.id === editingDomain?.id}
            columns={[
              { header: "Code", cell: (r) => <span className="font-medium">{r.code}</span> },
              { header: "Name", cell: (r) => r.name },
              { header: "Departments", cell: (r) => r.departments.length },
              { header: "Users", cell: (r) => r._count.users },
              { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
              {
                header: "Action",
                cell: (r) =>
                  permission.canEdit && (
                    <RowActions
                      editHref={`${ADMIN_PATHS.domains}?edit=${r.id}`}
                      toggle={toggleActive.bind(null, "domain", r.id)}
                      active={r.isActive}
                    />
                  ),
              },
            ]}
          />
        </Card>
        <Card title="Departments">
          <DataTable
            rows={departments}
            rowKey={(r) => r.id}
            highlight={(r) => r.id === editingDept?.id}
            columns={[
              { header: "Department", cell: (r) => <span className="font-medium">{r.name}</span> },
              { header: "Domain", cell: (r) => r.domainName },
              { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
              {
                header: "Action",
                cell: (r) =>
                  permission.canEdit && (
                    <RowActions
                      editHref={`${ADMIN_PATHS.domains}?editDept=${r.id}`}
                      toggle={toggleActive.bind(null, "department", r.id)}
                      active={r.isActive}
                    />
                  ),
              },
            ]}
          />
        </Card>
      </div>
    </AdminPage>
  );
}
