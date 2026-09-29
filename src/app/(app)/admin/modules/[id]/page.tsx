import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { NavIcon } from "@/components/ui/nav-icon";
import { saveMenu } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ADMIN_PATHS } from "@/modules/admin/paths";
import { getModuleWithMenus } from "@/modules/admin/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Menus" };

export default async function ModuleMenusPage({ params, searchParams }: PageProps<"/admin/modules/[id]">) {
  const { permission } = await requirePageAccess(ADMIN_PATHS.modules);
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const mod = await getModuleWithMenus(id);
  if (!mod) notFound();

  const groups = mod.menus.filter((m) => m.type === "GROUP");
  // Tree order: top-level entries, each group followed by its children.
  const rows = mod.menus
    .filter((m) => m.parentId === null)
    .flatMap((m) => [m, ...mod.menus.filter((c) => c.parentId === m.id)]);
  const editing = mod.menus.find((m) => m.id === param(sp, "edit"));
  const showForm = editing ? permission.canEdit : permission.canCreate;
  const base = `${ADMIN_PATHS.modules}/${mod.id}`;

  const fields: FieldConfig[] = [
    {
      name: "type",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { value: "ITEM", label: "Menu item (link)" },
        { value: "GROUP", label: "Group (heading)" },
      ],
    },
    { name: "title", label: "Title", required: true, placeholder: "All cases" },
    {
      name: "parentId",
      label: "Inside group",
      type: "select",
      options: groups.map((g) => ({ value: g.id, label: g.title })),
      hint: "Leave empty for a top-level item. Groups ignore this.",
    },
    {
      name: "path",
      label: "Path",
      placeholder: `${mod.path}/…`,
      hint: `Items only. Must start with ${mod.path}/`,
    },
    { name: "icon", label: "Icon", placeholder: "list", hint: "lucide.dev name, optional" },
    { name: "sortOrder", label: "Order", type: "number" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  return (
    <AdminPage
      title={`${mod.title} — menus`}
      subtitle="New items appear in the sidebar for privileges that are given View on them."
      saved={Boolean(param(sp, "saved"))}
      actions={
        <LinkButton href={ADMIN_PATHS.modules} variant="secondary">
          <ArrowLeft className="size-4" /> Back
        </LinkButton>
      }
    >
      {showForm && (
        <Card title={editing ? `Edit ${editing.title}` : "Add menu"}>
          <EntityForm
            fields={fields}
            action={saveMenu}
            id={editing?.id}
            initial={
              editing ?? { type: "ITEM", isActive: true, sortOrder: (rows.length + 1) * 10, path: `${mod.path}/` }
            }
            cancelHref={editing ? base : undefined}
            hidden={{ moduleId: mod.id }}
          />
        </Card>
      )}

      <Card title="Menu tree">
        <DataTable
          rows={rows}
          rowKey={(r) => r.id}
          highlight={(r) => r.id === editing?.id}
          empty="No menus yet — add a group or an item above."
          columns={[
            { header: "Order", cell: (r) => r.sortOrder },
            {
              header: "Title",
              cell: (r) => (
                <span className={cn("flex items-center gap-2", r.parentId && "pl-6")}>
                  <NavIcon name={r.icon} className="size-4 text-text-muted" />
                  <span className={cn(r.type === "GROUP" && "font-semibold uppercase text-xs tracking-wider")}>
                    {r.title}
                  </span>
                </span>
              ),
            },
            { header: "Type", cell: (r) => <Badge tone={r.type === "GROUP" ? "neutral" : "primary"}>{r.type}</Badge> },
            { header: "Path", cell: (r) => (r.path ? <code className="text-xs">{r.path}</code> : "—") },
            { header: "Code", cell: (r) => <span className="text-xs text-text-muted">{r.code}</span> },
            { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
            {
              header: "Action",
              cell: (r) =>
                permission.canEdit && (
                  <RowActions
                    editHref={`${base}?edit=${r.id}`}
                    toggle={toggleActive.bind(null, "menu", r.id)}
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
