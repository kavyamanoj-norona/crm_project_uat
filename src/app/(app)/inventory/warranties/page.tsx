import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { ListView } from "@/components/data/list-view";
import { DeleteButton } from "@/components/ui/delete-button";
import { listState, pageArgs } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { deleteWarranty, saveWarranty } from "@/modules/inventory/actions/warranty";
import { WarrantyForm } from "@/modules/inventory/components/warranty-form";

export const metadata = { title: "Manage Warranty" };

const SORTS = ["name", "createdAt"] as const;
const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function WarrantiesPage({ searchParams }: PageProps<"/inventory/warranties">) {
  const { permission } = await requirePageAccess(INVENTORY_PATHS.warranties);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.warranties, sp, { sorts: SORTS, defaultSort: "createdAt", defaultDir: "asc", defaultPageSize: 50 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const where: Prisma.WarrantyWhereInput = { isDelete: 0, ...(list.q ? { name: { contains: list.q, mode: "insensitive" } } : {}) };
  const [rows, total, editing] = await Promise.all([
    db.warranty.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      include: { _count: { select: { units: true } } },
    }),
    db.warranty.count({ where }),
    editId && permission.canEdit ? db.warranty.findFirst({ where: { id: editId, isDelete: 0 } }) : null,
  ]);

  return (
    <AdminPage
      title="Manage Warranty"
      group="Inventory"
      subtitle="Reusable warranty periods you pick for each item on a purchase bill"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Warranty",
              editingTitle: editing ? editing.name : undefined,
              cancelHref: INVENTORY_PATHS.warranties,
              content: (
                <WarrantyForm
                  action={saveWarranty}
                  id={editing?.id}
                  initial={editing ? { durationValue: String(editing.durationValue), durationUnit: editing.durationUnit } : undefined}
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
        rowKey={(w) => w.id}
        highlight={(w) => w.id === highlight}
        searchPlaceholder="Search by name"
        empty="No warranty periods yet. Add the ones you use on purchase bills."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Name", sort: "name", cell: (w) => <span className="font-medium">{w.name}</span> },
          { header: "Units covered", align: "center", cell: (w) => w._count.units },
          { header: "Added", sort: "createdAt", cell: (w) => formatDate(w.createdAt) },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (w: (typeof rows)[number]) => (
                    <span className="flex items-center gap-1">
                      <Link href={`${INVENTORY_PATHS.warranties}?edit=${w.id}`} className={iconLink} aria-label="Edit" title="Edit">
                        <Pencil className="size-4" />
                      </Link>
                      <DeleteButton action={deleteWarranty.bind(null, w.id)} />
                    </span>
                  ),
                },
              ]
            : []),
        ]}
      />
    </AdminPage>
  );
}
