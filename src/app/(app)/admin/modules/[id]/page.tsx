import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { NavIcon } from "@/components/ui/nav-icon";
import { listState } from "@/lib/list";
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

  const base = `${ADMIN_PATHS.modules}/${mod.id}`;
  // A module has a handful of menus, so the tree is filtered and paged in memory.
  const list = listState(base, sp, { sorts: ["tree"] as const, defaultSort: "tree", defaultDir: "asc" });

  const groups = mod.menus.filter((m) => m.type === "GROUP");
  // Tree order: top-level entries, each group followed by its children.
  const tree = mod.menus
    .filter((m) => m.parentId === null)
    .flatMap((m) => [m, ...mod.menus.filter((c) => c.parentId === m.id)]);
  const q = list.q.toLowerCase();
  const searched = q
    ? tree.filter((m) => [m.title, m.path ?? "", m.code].some((v) => v.toLowerCase().includes(q)))
    : tree;
  const filtered = searched.filter((m) => (list.tab === "groups" ? m.type === "GROUP" : list.tab === "items" ? m.type === "ITEM" : true));
  const rows = filtered.slice((list.page - 1) * list.pageSize, list.page * list.pageSize);
  const tabs = [
    { key: "", label: "All", count: searched.length },
    { key: "groups", label: "Groups", count: searched.filter((m) => m.type === "GROUP").length },
    { key: "items", label: "Items", count: searched.filter((m) => m.type === "ITEM").length },
  ];

  const editing = permission.canEdit ? mod.menus.find((m) => m.id === param(sp, "edit")) : undefined;

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
    { name: "title", label: "Title", required: true, placeholder: "Enter title" },
    {
      name: "parentId",
      label: "Inside group",
      type: "select",
      options: groups.map((g) => ({ value: g.id, label: g.title })),
      hint: "Leave empty for a top-level item. Groups ignore this.",
    },
    { name: "path", label: "Path", placeholder: `${mod.path}/…`, hint: `Items only. Must start with ${mod.path}/` },
    { name: "icon", label: "Icon", placeholder: "Enter icon name", hint: "lucide.dev name, optional" },
    { name: "sortOrder", label: "Order", type: "number" },
    { name: "isActive", label: "Active", type: "switch" },
  ];

  return (
    <AdminPage
      title={`${mod.title} — menus`}
      subtitle="New items appear in the sidebar for privileges that are given View on them."
      saved={param(sp, "saved")}
      actions={
        <LinkButton href={ADMIN_PATHS.modules} variant="secondary">
          <ArrowLeft className="size-4" /> Back
        </LinkButton>
      }
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Menu",
              editingTitle: editing?.title,
              cancelHref: base,
              content: (
                <EntityForm
                  fields={fields}
                  schema="menu" action={saveMenu}
                  id={editing?.id}
                  initial={editing ?? { type: "ITEM", isActive: true, sortOrder: (tree.length + 1) * 10, path: `${mod.path}/` }}
                  hidden={{ moduleId: mod.id }}
                />
              ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={filtered.length}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search title, path or code…"
        empty="No menus yet — add a group or an item."
        columns={[
          { header: "Order", align: "center", cell: (r) => r.sortOrder },
          {
            header: "Title",
            cell: (r) => (
              <span className={cn("flex items-center gap-2", r.parentId && "pl-6")}>
                <NavIcon name={r.icon} className="size-4 text-text-muted" />
                <span className={cn(r.type === "GROUP" && "text-xs font-semibold tracking-wider uppercase")}>{r.title}</span>
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
                <RowActions editHref={`${base}?edit=${r.id}`} toggle={toggleActive.bind(null, "menu", r.id)} active={r.isActive} />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
