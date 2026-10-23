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
import { STOCK_SORTS, countAvailableUnits, listOfficeConsumedPage, listPhysicalItems, listStockPage, listStockUnitsPage } from "@/modules/inventory/queries";
import { consumeOfficeUnit } from "@/modules/inventory/actions/office";
import { OfficeConsumeDialog } from "@/modules/inventory/components/office-consume-dialog";
import { isPurchaseManager } from "@/modules/inventory/purchase-access";
import { listActiveStaff } from "@/modules/service/queries";
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
  const viewParam = param(sp, "view");
  const view = viewParam === "units" ? "units" : viewParam === "office" ? "office" : "items";
  // Bill no. and supplier are for the Purchase Manager and admins only.
  const showBill = isPurchaseManager(user);
  // Only the Purchase Manager (and admins) hand office-use units to employees.
  const canOfficeConsume = canEdit && isPurchaseManager(user);

  const [{ rows, total, tabs, valuePaise }, units, officeConsumed, employees, unitCounts, physicalItems, branchOptions, editing] = await Promise.all([
    listStockPage(list, scope.branchId, withHo),
    view === "units" ? listStockUnitsPage(list, scope.branchId, withHo, showBill) : Promise.resolve({ rows: [], total: 0, tabs: [] }),
    view === "office" ? listOfficeConsumedPage(list) : Promise.resolve({ rows: [], total: 0 }),
    view === "units" && canOfficeConsume ? listActiveStaff() : Promise.resolve([] as { value: string; label: string }[]),
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
        {!user.privilege.isBranchBound && (
          <LinkButton href={`${INVENTORY_PATHS.stock}?view=office`} variant={view === "office" ? "primary" : "secondary"} size="sm">
            Office Consumed
          </LinkButton>
        )}
      </div>
      {view === "office" ? (
        <ListView
          list={list}
          total={officeConsumed.total}
          rows={officeConsumed.rows}
          rowKey={(u) => u.id}
          searchPlaceholder="Search by USID, item, employee, remarks or bill"
          empty="Nothing consumed for the office yet. Consume an office-use unit from Units (USIDs) → Office use."
          columns={[
            { header: "#", cell: (_, i) => i + 1 + (list.page - 1) * list.pageSize },
            { header: "USID", cell: (u) => <span className="font-medium tabular-nums">{u.usid}</span> },
            {
              header: "Item",
              cell: (u) => (
                <>
                  <p className="flex items-center gap-2 font-medium">
                    {u.item.name} <Badge tone="violet">Office use</Badge>
                  </p>
                  <p className="text-xs text-text-muted">{u.item.code}</p>
                </>
              ),
            },
            {
              header: "Employee",
              cell: (u) => (u.officeEmployee ? [u.officeEmployee.firstName, u.officeEmployee.lastName].filter(Boolean).join(" ") : "—"),
            },
            { header: "Remarks", cell: (u) => <p className="max-w-60 whitespace-pre-wrap break-words text-sm">{u.officeRemarks ?? "—"}</p> },
            {
              header: "Bill",
              cell: (u) =>
                u.billItem ? (
                  <>
                    <Link href={`${INVENTORY_PATHS.billing}/${u.billItem.bill.id}`} className="text-primary hover:underline">
                      {u.billItem.bill.billNo}
                    </Link>
                    {u.billItem.bill.officePurpose && <p className="text-xs text-text-muted">{u.billItem.bill.officePurpose}</p>}
                  </>
                ) : (
                  "—"
                ),
            },
            {
              header: "Warranty",
              cell: (u) => (u.warrantyEndsAt ? <>{u.warrantyLabel ?? u.warranty?.name}<p className="text-xs text-text-muted">until {formatDate(u.warrantyEndsAt)}</p></> : "—"),
            },
            {
              header: "Consumed",
              cell: (u) => (
                <span className="text-xs text-text-muted">
                  {u.consumedAt ? formatDate(u.consumedAt) : "—"}
                  {u.consumedBy && <> · {[u.consumedBy.firstName, u.consumedBy.lastName].filter(Boolean).join(" ")}</>}
                </span>
              ),
            },
          ]}
        />
      ) : view === "units" ? (
      <ListView
        list={list}
        total={units.total}
        tabs={units.tabs}
        rows={units.rows}
        rowKey={(u) => u.id}
        searchPlaceholder={showBill ? "Search by USID, item, bill, supplier or case ID" : "Search by USID, item or case ID"}
        empty="No units yet. Each unit appears here with its USID when a supplier bill is saved under Billing."
        columns={[
          { header: "#", cell: (_, i) => i + 1 + (list.page - 1) * list.pageSize },
          { header: "USID", cell: (u) => <span className="font-medium tabular-nums">{u.usid}</span> },
          {
            header: "Item",
            cell: (u) => (
              <>
                <p className="flex items-center gap-2 font-medium">
                  {u.item.name} {u.isOfficeUse && <Badge tone="violet">Office use</Badge>}
                </p>
                <p className="text-xs text-text-muted">{u.item.code}</p>
              </>
            ),
          },
          ...(showBill
            ? [
              {
                header: "Bill",
                cell: (u: (typeof units.rows)[number]) =>
                  u.billItem ? (
                    <Link href={`${INVENTORY_PATHS.billing}/${u.billItem.bill.id}`} className="text-primary hover:underline">
                      {u.billItem.bill.billNo}
                    </Link>
                  ) : (
                    <span className="text-text-muted">No bill</span>
                  ),
              },
              { header: "Supplier", cell: (u: (typeof units.rows)[number]) => u.billItem?.bill.supplier.name ?? "—" },
              ]
            : []),
          {
            header: "Warranty",
            cell: (u) => (u.warrantyEndsAt ? <>{u.warrantyLabel ?? u.warranty?.name}<p className="text-xs text-text-muted">until {formatDate(u.warrantyEndsAt)}</p></> : "—"),
          },
          { header: "Location", cell: (u) => `${u.branch.name} (${u.branch.code})` },
          {
            header: "Status",
            cell: (u) =>
              // A unit on a case that is Ready for delivery shows as RFD instead of Allocated / Received / Consumed.
              u.allocatedCase?.status === "READY_FOR_DELIVERY" && ["ALLOCATED", "RECEIVED", "CONSUMED"].includes(u.status) ? (
                <Badge tone="success">RFD</Badge>
              ) : u.allocatedCase?.status === "CLOSED" && ["ALLOCATED", "RECEIVED", "CONSUMED"].includes(u.status) ? (
                <Badge tone="neutral">Closed</Badge>
              ) : u.status === "AVAILABLE" ? (
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
          ...(canOfficeConsume
            ? [
                {
                  header: "Action",
                  cell: (u: (typeof units.rows)[number]) =>
                    u.isOfficeUse && u.status === "AVAILABLE" ? (
                      <OfficeConsumeDialog usid={u.usid} itemName={u.item.name} employees={employees} action={consumeOfficeUnit.bind(null, u.id)} />
                    ) : null,
                },
              ]
            : []),
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
                <p className="text-xs text-text-muted">
                  {s.item.code} · {s.item.category.name}
                </p>
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
