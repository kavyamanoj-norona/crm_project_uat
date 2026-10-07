import Link from "next/link";
import { db } from "@/server/db";
import { ActiveBadge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { saveDomain } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { CompanyTabs } from "@/modules/admin/components/company-tabs";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { DOMAIN_SORTS, listDomains } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Domains" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "Enter domain code" },
  { name: "name", label: "Domain name", required: true, placeholder: "Enter domain name" },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function DomainsPage({ searchParams }: PageProps<"/admin/companies/domains">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.domains);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.domains, sp, { sorts: DOMAIN_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs }, editing] = await Promise.all([
    listDomains(list),
    editId && permission.canEdit ? db.domain.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Company"
      subtitle="Domains group departments; every user belongs to one department."
      saved={param(sp, "saved")}
      nav={<CompanyTabs active="domains" />}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Domain",
              editingTitle: editing?.name,
              cancelHref: ADMIN_PATHS.domains,
              content: (
                <EntityForm fields={FIELDS} schema="domain" action={saveDomain} id={editing?.id} initial={editing ?? { isActive: true }} />
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
        searchPlaceholder="Search domain…"
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Code", sort: "code", cell: (r) => <span className="font-medium">{r.code}</span> },
          { header: "Name", sort: "name", cell: (r) => r.name },
          {
            header: "Departments",
            align: "center",
            cell: (r) => (
              <Link href={`${ADMIN_PATHS.departments}?tab=${r.id}`} className="text-primary hover:underline">
                {r._count.departments}
              </Link>
            ),
          },
          { header: "Users", cell: (r) => r._count.users, align: "center" },
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
    </AdminPage>
  );
}
