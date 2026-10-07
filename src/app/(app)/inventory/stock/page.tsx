import { Package } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { param } from "@/modules/admin/components/admin-page";
import { formatPaise } from "@/lib/money";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";
import { adjustStock } from "@/modules/inventory/actions/stock";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { listPhysicalItems, listStock } from "@/modules/inventory/queries";
import { StockTableClient } from "./stock-table-client";

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
    { name: "quantity", label: "Quantity", type: "number", required: true, placeholder: "Enter quantity" },
    {
      name: "unitCodes",
      label: "Unit codes",
      placeholder: "Enter serial numbers (comma-separated)",
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

        <StockTableClient
          stock={stock}
          canEdit={canEdit}
          branchName={scope.branch?.name}
        />
      </div>
    </>
  );
}
