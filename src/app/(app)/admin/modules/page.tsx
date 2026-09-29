import Link from "next/link";
import { ListTree } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ActiveBadge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { NavIcon } from "@/components/ui/nav-icon";
import { saveModule } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { listModules } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Modules" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "service" },
  { name: "title", label: "Title", required: true, placeholder: "Service" },
  { name: "path", label: "Route prefix", required: true, placeholder: "/service" },
  {
    name: "icon",
    label: "Icon",
    required: true,
    placeholder: "wrench",
    hint: "Any lucide.dev icon name, kebab-case",
  },
  { name: "sortOrder", label: "Order on rail", type: "number" },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function ModulesPage({ searchParams }: PageProps<"/admin/modules">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.modules);
  const sp = await searchParams;
  const rows = await listModules();
  const editing = rows.find((r) => r.id === param(sp, "edit"));
  const showForm = editing ? permission.canEdit : permission.canCreate;

  return (
    <AdminPage
      title="Modules"
      subtitle="Each module is an icon on the rail. Open Menus to add sidebar groups and items."
      saved={Boolean(param(sp, "saved"))}
    >
      {showForm && (
        <Card title={editing ? `Edit ${editing.title}` : "Add module"}>
          <EntityForm
            fields={FIELDS}
            action={saveModule}
            id={editing?.id}
            initial={editing ?? { isActive: true, sortOrder: (rows.at(-1)?.sortOrder ?? 0) + 1 }}
            cancelHref={editing ? ADMIN_PATHS.modules : undefined}
          />
        </Card>
      )}

      <Card title="Modules">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          highlight={(r) => r.id === editing?.id}
          columns={[
            { header: "Order", cell: (r) => r.sortOrder },
            { header: "Icon", cell: (r) => <NavIcon name={r.icon} className="size-5 text-primary" /> },
            { header: "Title", cell: (r) => <span className="font-medium">{r.title}</span> },
            { header: "Code", cell: (r) => r.code },
            { header: "Path", cell: (r) => <code className="text-xs">{r.path}</code> },
            { header: "Menus", cell: (r) => r._count.menus },
            { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
            {
              header: "Action",
              cell: (r) => (
                <RowActions
                  editHref={permission.canEdit ? `${ADMIN_PATHS.modules}?edit=${r.id}` : undefined}
                  toggle={permission.canEdit ? toggleActive.bind(null, "module", r.id) : undefined}
                  active={r.isActive}
                >
                  <Link
                    href={`${ADMIN_PATHS.modules}/${r.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-primary hover:bg-primary-soft"
                  >
                    <ListTree className="size-3.5" /> Menus
                  </Link>
                </RowActions>
              ),
            },
          ]}
        />
      </Card>
    </AdminPage>
  );
}
