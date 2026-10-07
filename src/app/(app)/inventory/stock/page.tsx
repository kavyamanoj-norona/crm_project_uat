import { Package, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { adjustStock, consumeStockItem } from "@/modules/inventory/actions/stock";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { listPhysicalItems, listStock } from "@/modules/inventory/queries";

export const metadata = { title: "Stock" };

export default async function StockPage({ searchParams }: PageProps<"/inventory/stock">) {
  const { permission, user } = await requirePageAccess(INVENTORY_PATHS.stock);
  const sp = await searchParams;
  const action = param(sp, "action");
  const saved = param(sp, "saved");

  const scope = await getBranchScope(user);
  const canEdit = permission.canEdit;

  const [stock, physicalItems, branchOptions] = await Promise.all([
    listStock(scope.branchId),
    listPhysicalItems(),
    listBranchOptions(),
  ]);

  const totalValuePaise = stock.reduce((sum, s) => sum + s.quantity * s.item.pricePaise, 0);

  const branchField: FieldConfig[] = scope.branchId
    ? []
    : [{ name: "branchId", label: "Branch", type: "select" as const, required: true, options: branchOptions.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` })) }];

  const physicalItemOptions = physicalItems.map((i) => ({ value: i.id, label: `${i.code} — ${i.name}` }));

  const stockAdjustFields: FieldConfig[] = [
    ...branchField,
    { name: "itemId", label: "Item (part / accessory)", type: "select", required: true, options: physicalItemOptions },
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "2" },
    {
      name: "unitCodes",
      label: "Unit codes",
      placeholder: "KB123, KB124 (comma-separated)",
      hint: "Sticker IDs on physical units",
      span: 2,
    },
  ];

  return (
    <>
      <FlashToast flag={saved} message="Saved successfully." />
      <PageHeader
        title="Stock"
        subtitle={scope.branch ? `Branch: ${scope.branch.name}` : scope.canSwitch ? "Select a branch in the header to filter" : undefined}
        breadcrumbs={["Inventory", "Stock"]}
        actions={
          canEdit && (
            <LinkButton href={`${INVENTORY_PATHS.stock}?action=stock-adjust`}>
              <Package className="size-4" /> Adjust stock
            </LinkButton>
          )
        }
      />

      {action === "stock-adjust" && canEdit && (
        <div className="mb-6 rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Adjust stock</h2>
            <LinkButton href={INVENTORY_PATHS.stock} variant="secondary">Cancel</LinkButton>
          </div>
          <EntityForm fields={stockAdjustFields} schema="stockAdjust" action={adjustStock} submitLabel="Save stock" />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Branch inventory</p>
            <p className="mt-0.5 font-bold">
              {scope.branch ? `— ${scope.branch.name}` : scope.canSwitch ? "— all branches" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">value</p>
            <p className="font-semibold tabular-nums">{formatPaise(totalValuePaise)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-xs font-semibold text-text">
              <th className="px-6 py-3 text-left border-r border-border">Part</th>
              <th className="px-6 py-3 text-left border-r border-border">Unit codes</th>
              <th className="px-6 py-3 text-right border-r border-border">Stock</th>
              <th className="px-6 py-3 text-right border-r border-border">Min ₹</th>
              <th className="px-6 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {stock.map((s) => {
              const low = s.quantity > 0 && s.quantity <= 2;
              const out = s.quantity === 0;
              return (
                <tr key={s.id}>
                  <td className="px-6 py-3 font-medium">{s.item.name}</td>
                  <td className="px-6 py-3 text-xs text-text-muted">
                    {s.unitCodes.length > 0 ? s.unitCodes.join(", ") : <span className="text-text-disabled">—</span>}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <span className="inline-flex items-center justify-end gap-2">
                      {s.quantity}
                      {low && <Badge tone="warning">Low</Badge>}
                      {out && <Badge tone="danger">No Stock</Badge>}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right font-semibold tabular-nums">
                    {formatPaise(minPricePaise(s.item.pricePaise, s.item.maxDiscountPercent))}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {out ? (
                      <a
                        href={`${INVENTORY_PATHS.purchasing}?action=purchase-request&itemId=${s.item.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary/30 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/5"
                      >
                        <ShoppingCart className="size-3" /> Request
                      </a>
                    ) : canEdit ? (
                      <form action={consumeStockItem.bind(null, s.id)}>
                        <button
                          type="submit"
                          className="rounded-lg border border-border px-3 py-1 text-xs font-medium hover:bg-surface-muted"
                        >
                          Consume
                        </button>
                      </form>
                    ) : null}
                  </td>
                </tr>
              );
            })}
            {stock.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-text-muted">
                  No stock recorded{scope.branch ? ` for ${scope.branch.name}` : ""} yet.
                  {canEdit && (
                    <> <a href={`${INVENTORY_PATHS.stock}?action=stock-adjust`} className="text-primary underline">Add stock</a>.</>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
