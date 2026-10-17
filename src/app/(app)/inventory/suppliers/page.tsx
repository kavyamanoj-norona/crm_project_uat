import Link from "next/link";
import { Pencil } from "lucide-react";
import { db } from "@/server/db";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { DeleteButton } from "@/components/ui/delete-button";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { SUPPLIER_SORTS, listSuppliersPage, type SupplierPageRow } from "@/modules/inventory/billing-queries";
import { deleteSupplier, saveSupplier } from "@/modules/inventory/actions/supplier";
import { SupplierForm, type SupplierFormValues } from "@/modules/inventory/components/supplier-form";

export const metadata = { title: "Suppliers" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function SuppliersPage({ searchParams }: PageProps<"/inventory/suppliers">) {
  const { permission } = await requirePageAccess(INVENTORY_PATHS.suppliers);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.suppliers, sp, { sorts: SUPPLIER_SORTS, defaultSort: "createdAt", defaultPageSize: 50 });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const [{ rows, total, tabs }, editing] = await Promise.all([
    listSuppliersPage(list),
    editId && permission.canEdit ? db.supplier.findUnique({ where: { id: editId } }) : null,
  ]);

  const initial: SupplierFormValues | undefined = editing
    ? {
        name: editing.name,
        gstin: editing.gstin ?? "",
        state: editing.state ?? "",
        phone: editing.phone ?? "",
        email: editing.email ?? "",
        address: editing.address ?? "",
        paymentTermDays: editing.paymentTermDays === null ? "" : String(editing.paymentTermDays),
      }
    : undefined;

  return (
    <AdminPage
      title="Suppliers"
      group="Inventory"
      subtitle="Who parts and accessories are bought from"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Supplier",
              editingTitle: editing ? editing.name : undefined,
              cancelHref: INVENTORY_PATHS.suppliers,
              content: <SupplierForm action={saveSupplier} initial={initial} id={editing?.id} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(s) => s.id}
        highlight={(s) => s.id === highlight}
        searchPlaceholder="Search by name, GSTIN, phone or email"
        empty="No suppliers added yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Date", sort: "createdAt", cell: (s) => formatDate(s.createdAt) },
          { header: "Name", sort: "name", cell: (s) => <span className="font-medium">{s.name}</span> },
          { header: "GSTIN", cell: (s) => s.gstin ?? "—" },
          { header: "State", cell: (s) => s.state ?? "—" },
          { header: "Phone", cell: (s) => s.phone ?? "—" },
          { header: "Email", cell: (s) => s.email ?? "—" },
          { header: "Bills", align: "center", cell: (s) => s._count.bills },
          ...(permission.canEdit
            ? [
                {
                  header: "Action",
                  cell: (s: SupplierPageRow) => (
                    <span className="flex items-center gap-1">
                      <Link href={`${INVENTORY_PATHS.suppliers}?edit=${s.id}`} className={iconLink} aria-label="Edit" title="Edit">
                        <Pencil className="size-4" />
                      </Link>
                      <DeleteButton action={deleteSupplier.bind(null, s.id)} />
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
