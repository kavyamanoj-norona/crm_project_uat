import Link from "next/link";
import { Pencil } from "lucide-react";
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
import { syncStockWithUnits } from "@/modules/inventory/stock-sync";
import { adjustStock, consumeStockItem } from "@/modules/inventory/actions/stock";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { STOCK_SORTS, countAvailableUnits, listPhysicalItems, listStockPage, listStockUnitsPage } from "@/modules/inventory/queries";
import { LinkButton } from "@/components/ui/button";

export const metadata = { title: "Stock" };

const iconLink =
  "inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-surface-muted hover:text-text";

export default async function StockPage({ searchParams }: PageProps<"/inventory/stock">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.stock, sp, { sorts: STOCK_SORTS, defaultSort: "updatedAt" });
  const editId = param(sp, "edit");
  const highlight = param(sp, "highlight") ?? editId;

  await syncStockWithUnits();
  const scope = await getBranchScope(user);
  const canEdit = permission.canEdit;

  // Head Office holds the purchased stock: its owners see it in every branch view, branch users never do.
  const withHo = !user.privilege.isBranchBound;
  const view = param(sp, "view") === "units" ? "units" : "items";

  const [{ rows, total, tabs, valuePaise }, units, unitCounts, physicalItems, branchOptions, editing] = await Promise.all([
    listStockPage(list, scope.branchId, withHo),
    view === "units" ? listStockUnitsPage(list, scope.branchId, withHo) : Promise.resolve({ rows: [], total: 0, tabs: [] }),
    countAvailableUnits(scope.branchId, withHo),
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
    { name: "itemId", label: "Item (part / accessory)", type: "select", searchable: true, required: true, placeholder: "Select item", options: physicalItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` })) },
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
      <div className="flex flex-wrap gap-2">
        <LinkButton href={INVENTORY_PATHS.stock} variant={view === "items" ? "primary" : "secondary"} size="sm">
          Items
        </LinkButton>
        <LinkButton href={`${INVENTORY_PATHS.stock}?view=units`} variant={view === "units" ? "primary" : "secondary"} size="sm">
          Units (USIDs)
        </LinkButton>
      </div>
      {view === "units" ? (
      <ListView
        list={list}
        total={units.total}
        tabs={units.tabs}
        rows={units.rows}
        rowKey={(u) => u.id}
        searchPlaceholder="Search by USID, item, bill, supplier or case ID"
        empty="No units yet. Each unit appears here with its USID when a supplier bill is saved under Billing."
        columns={[
          { header: "#", cell: (_, i) => i + 1 + (list.page - 1) * list.pageSize },
          { header: "USID", cell: (u) => <span className="font-medium tabular-nums">{u.usid}</span> },
          {
            header: "Item",
            cell: (u) => (
              <>
                <p className="font-medium">{u.item.name}</p>
                <p className="text-xs text-text-muted">{u.item.code}</p>
              </>
            ),
          },
          {
            header: "Bill",
            cell: (u) =>
              u.billItem ? (
                <Link href={`${INVENTORY_PATHS.billing}/${u.billItem.bill.id}`} className="text-primary hover:underline">
                  {u.billItem.bill.billNo}
                </Link>
              ) : (
                <span className="text-text-muted">No bill</span>
              ),
          },
          { header: "Supplier", cell: (u) => u.billItem?.bill.supplier.name ?? "—" },
          { header: "Location", cell: (u) => `${u.branch.name} (${u.branch.code})` },
          {
            header: "Status",
            cell: (u) =>
              u.status === "AVAILABLE" ? (
                <Badge tone="success">Available</Badge>
              ) : u.status === "RECEIVED" ? (
                <Badge tone="navy">Received</Badge>
              ) : u.status === "RETURNED" ? (
                <Badge tone="danger">Returned (damaged)</Badge>
              ) : u.status === "AWAITING_VENDOR" ? (
                <Badge tone="warning">With vendor</Badge>
              ) : u.status === "CONSUMED" ? (
                <Badge tone="neutral">Consumed</Badge>
              ) : (
                <Badge tone="primary">Allocated</Badge>
              ),
          },
          {
            header: "Allocated to",
            cell: (u) =>
              u.allocatedCase ? (
                <>
                  <Link href={`/service/cases/${u.allocatedCase.id}`} className="font-medium text-primary hover:underline">
                    {u.allocatedCase.jobsheetNo}
                  </Link>
                  <p className="text-xs text-text-muted">{u.allocatedBranch?.code}</p>
                </>
              ) : (
                "—"
              ),
          },
        ]}
      />
      ) : (
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
            header: "USIDs",
            align: "right",
            cell: (s) => {
              const n = unitCounts.get(`${s.branchId}:${s.itemId}`) ?? 0;
              if (n === 0 && s.quantity === 0) return <span className="text-text-disabled">—</span>;
              if (n > s.quantity) return <Badge tone="danger">{n} (more than stock)</Badge>;
              return (
                <span className="tabular-nums">
                  {n}
                  {n < s.quantity && <span className="ml-1 text-xs text-text-muted">· {s.quantity - n} without USID</span>}
                </span>
              );
            },
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
                {s.quantity > 0 && canEdit ? (
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
      )}
    </AdminPage>
  );
}
