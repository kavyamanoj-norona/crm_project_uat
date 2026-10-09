import Link from "next/link";
import { Pencil, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { db } from "@/server/db";
import { adjustStock, consumeStockItem } from "@/modules/inventory/actions/stock";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { STOCK_SORTS, listPhysicalItems, listStockPage } from "@/modules/inventory/queries";

export const metadata = { title: "Stock" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function StockPage({ searchParams }: PageProps<"/inventory/stock">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.stock, sp, { sorts: STOCK_SORTS, defaultSort: "updatedAt" });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  const scope = await getBranchScope(user);
  const canEdit = permission.canEdit;

  const [{ rows, total, tabs, valuePaise }, physicalItems, branchOptions, editing] = await Promise.all([
    listStockPage(list, scope.branchId),
    listPhysicalItems(),
    listBranchOptions(),
    editId && canEdit
      ? db.stockItem.findFirst({ where: { id: editId, ...(scope.branchId ? { branchId: scope.branchId } : {}) } })
      : null,
  ]);

  const branchField: FieldConfig[] = scope.branchId
    ? []
    : [{ name: "branchId", label: "Branch", type: "select", required: true, placeholder: "Select branch", options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }];

  const stockAdjustFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item (part / accessory)", type: "select", required: true, placeholder: "Select item", options: physicalItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })) },
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "Enter quantity" },
    { name: "unitCodes", label: "Unit codes", placeholder: "Enter unit codes (comma-separated)", hint: "Sticker IDs on physical units", span: 2 },
  ];

  const initial = editing
    ? { branchId: editing.branchId, itemId: editing.itemId, quantity: editing.quantity, unitCodes: editing.unitCodes.join(", ") }
    : undefined;
  const editingRow = editing ? rows.find((r) => r.id === editing.id) : undefined;

  const where = scope.branch ? `Branch: ${scope.branch.name}` : scope.canSwitch ? "All branches" : "";
  const subtitle = [where, `Stock value ${formatPaise(valuePaise)}`].filter(Boolean).join(" · ");

  return (
    <AdminPage
      title="Stock"
      group="Inventory"
      subtitle={subtitle}
      saved={param(sp, "saved")}
      form={
        canEdit
          ? {
              label: "Adjust stock",
              editingTitle: editing ? (editingRow?.item.name ?? "stock") : undefined,
              cancelHref: INVENTORY_PATHS.stock,
              content: (
                <EntityForm fields={stockAdjustFields} schema="stockAdjust" action={adjustStock} initial={initial} submitLabel="Save stock" />
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
        rowKey={(s) => s.id}
        highlight={(s) => s.id === highlight}
        searchPlaceholder="Search by part, code or branch"
        empty={`No stock recorded${scope.branch ? ` for ${scope.branch.name}` : ""} yet.`}
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Updated", sort: "updatedAt", cell: (s) => formatDate(s.updatedAt) },
          {
            header: "Part",
            sort: "name",
            cell: (s) => (
              <>
                <p className="font-medium">{s.item.name}</p>
                <p className="text-xs text-text-muted">{s.item.code}</p>
              </>
            ),
          },
          { header: "Branch", sort: "branch", cell: (s) => `${s.branch.name} (${s.branch.code})` },
          {
            header: "Unit codes",
            cell: (s) =>
              s.unitCodes.length > 0 ? (
                <span className="text-xs text-text-muted">{s.unitCodes.join(", ")}</span>
              ) : (
                <span className="text-text-disabled">—</span>
              ),
          },
          {
            header: "Stock",
            sort: "quantity",
            align: "right",
            cell: (s) => (
              <span className="inline-flex items-center justify-end gap-2 tabular-nums">
                {s.quantity}
                {s.quantity > 0 && s.quantity <= 2 && <Badge tone="warning">Low</Badge>}
                {s.quantity === 0 && <Badge tone="danger">No Stock</Badge>}
              </span>
            ),
          },
          {
            header: "Min ₹",
            align: "right",
            cell: (s) => (
              <span className="font-semibold tabular-nums">
                {formatPaise(minPricePaise(s.item.pricePaise, s.item.maxDiscountPercent))}
              </span>
            ),
          },
          {
            header: "Action",
            cell: (s) => (
              <span className="flex items-center gap-1">
                {canEdit && (
                  <Link href={`${INVENTORY_PATHS.stock}?edit=${s.id}`} className={iconLink} aria-label="Edit" title="Edit">
                    <Pencil className="size-4" />
                  </Link>
                )}
                {s.quantity === 0 ? (
                  <Link
                    href={`${INVENTORY_PATHS.purchasing}?action=purchase-request&itemId=${s.item.id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                  >
                    <ShoppingCart className="size-3" /> Request
                  </Link>
                ) : canEdit ? (
                  <form action={consumeStockItem.bind(null, s.id)}>
                    <button type="submit" className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted">
                      Consume
                    </button>
                  </form>
                ) : null}
              </span>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
