import Link from "next/link";
import { ListTree } from "lucide-react";
import { db } from "@/server/db";
import { ActiveBadge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { NavIcon } from "@/components/ui/nav-icon";
import { listState } from "@/lib/list";
import { saveModule } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { MODULE_SORTS, listModules } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Modules" };

const FIELDS: FieldConfig[] = [
  { name: "code", label: "Code", required: true, placeholder: "Enter module code" },
  { name: "title", label: "Title", required: true, placeholder: "Enter module name" },
  { name: "path", label: "Route prefix", required: true, placeholder: "Enter route path" },
  { name: "icon", label: "Icon", required: true, placeholder: "Enter icon name", hint: "Any lucide.dev icon name, kebab-case" },
  { name: "sortOrder", label: "Order on rail", type: "number" },
  { name: "isActive", label: "Active", type: "switch" },
];

export default async function ModulesPage({ searchParams }: PageProps<"/admin/modules">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.modules);
  const sp = await searchParams;
  const list = listState(ADMIN_PATHS.modules, sp, { sorts: MODULE_SORTS, defaultSort: "sortOrder", defaultDir: "asc" });
  const editId = param(sp, "edit");
  const [{ rows, total, tabs, nextSortOrder }, editing] = await Promise.all([
    listModules(list),
    editId && permission.canEdit ? db.module.findUnique({ where: { id: editId } }) : null,
  ]);

  return (
    <AdminPage
      title="Modules"
      subtitle="Each module is an icon on the rail. Open Menus to add its sidebar items."
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Module",
              editingTitle: editing?.title,
              cancelHref: ADMIN_PATHS.modules,
              content: (
                <EntityForm
                  fields={FIELDS}
                  schema="module" action={saveModule}
                  id={editing?.id}
                  initial={editing ?? { isActive: true, sortOrder: nextSortOrder }}
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
        searchPlaceholder="Search module…"
        columns={[
          { header: "Order", sort: "sortOrder", align: "center", cell: (r) => r.sortOrder },
          { header: "Icon", align: "center", cell: (r) => <NavIcon name={r.icon} className="mx-auto size-5 text-primary" /> },
          { header: "Title", sort: "title", cell: (r) => <span className="font-medium">{r.title}</span> },
          { header: "Code", sort: "code", cell: (r) => r.code },
          { header: "Path", sort: "path", cell: (r) => <code className="text-xs">{r.path}</code> },
          { header: "Menus", align: "center", cell: (r) => r._count.menus },
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
    </AdminPage>
  );
}
