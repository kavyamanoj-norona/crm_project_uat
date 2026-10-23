import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { WhoWhen } from "@/components/data/who-when";
import { listState, pageArgs } from "@/lib/list";
import { saveItemCategory } from "@/modules/admin/actions/save";
import { deleteRecord } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Categories" };

const SORTS = ["name", "updatedAt"] as const;

const fields: FieldConfig[] = [
  { name: "name", label: "Category name", required: true, placeholder: "Enter category name", hint: "Unique; items are filed under it" },
  { name: "isActive", label: "Active (can be picked on items)", type: "switch" },
];

export default async function CategoriesPage({ searchParams }: PageProps<"/inventory/categories">) {
  const { permission } = await requirePageAccess(INVENTORY_PATHS.categories);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.categories, sp, { sorts: SORTS, defaultSort: "name", defaultDir: "asc", defaultPageSize: 50 });
  const editId = param(sp, "edit");

  const where: Prisma.ItemCategoryWhereInput = { isDelete: 0, ...(list.q ? { name: { contains: list.q, mode: "insensitive" } } : {}) };
  const [rows, total, editing] = await Promise.all([
    db.itemCategory.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      include: { _count: { select: { items: { where: { isDelete: 0 } } } } },
    }),
    db.itemCategory.count({ where }),
    editId && permission.canEdit ? db.itemCategory.findFirst({ where: { id: editId, isDelete: 0 } }) : null,
  ]);

  // Who last changed each row (the category table keeps plain user ids).
  const userIds = [...new Set(rows.map((r) => r.updatedById).filter((v): v is string => Boolean(v)))];
  const users = userIds.length ? await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }) : [];
  const byId = new Map(users.map((u) => [u.id, u]));

  return (
    <AdminPage
      title="Categories"
      group="Inventory"
      subtitle="The managed list every item is filed under: Adapter, Battery, Display and so on"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Category",
              editingTitle: editing ? editing.name : undefined,
              cancelHref: INVENTORY_PATHS.categories,
              content: (
                <EntityForm
                  fields={fields}
                  schema="itemCategory"
                  action={saveItemCategory}
                  id={editing?.id}
                  initial={editing ?? { isActive: true }}
                />
              ),
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        rows={rows}
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search by name"
        empty="No categories yet. Add the ones your items are filed under."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Name", sort: "name", cell: (r) => <span className="font-medium">{r.name}</span> },
          { header: "Items", align: "center", cell: (r) => r._count.items },
          { header: "Status", cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Inactive"}</Badge> },
          { header: "Last updated", sort: "updatedAt", cell: (r) => <WhoWhen by={r.updatedById ? byId.get(r.updatedById) ?? null : null} at={r.updatedAt} /> },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (r: (typeof rows)[number]) => (
                    <RowActions editHref={`${INVENTORY_PATHS.categories}?edit=${r.id}`} remove={deleteRecord.bind(null, "itemCategory", r.id)} />
                  ),
                },
              ]
            : []),
        ]}
      />
    </AdminPage>
  );
}
