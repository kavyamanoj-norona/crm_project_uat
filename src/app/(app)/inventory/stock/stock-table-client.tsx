"use client";

import { useState } from "react";
import { Package, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SelectChip } from "@/components/data/filter-chip";
import { DataTable } from "@/components/data/data-table";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { consumeStockItem } from "@/modules/inventory/actions/stock";

type StockItem = {
  id: string;
  quantity: number;
  unitCodes: string[];
  item: {
    name: string;
    pricePaise: number;
    maxDiscountPercent: number;
    id: string;
  };
};

export function StockTableClient({
  stock,
  canEdit,
  branchName,
}: {
  stock: StockItem[];
  canEdit: boolean;
  branchName?: string;
}) {
  const [statusFilter, setStatusFilter] = useState("");

  const STATUS_OPTIONS = [
    { value: "in", label: "In Stock" },
    { value: "low", label: "Low Stock" },
    { value: "out", label: "Out of Stock" },
  ];

  const filtered = stock.filter((s) => {
    if (statusFilter === "in") return s.quantity > 2;
    if (statusFilter === "low") return s.quantity > 0 && s.quantity <= 2;
    if (statusFilter === "out") return s.quantity === 0;
    return true;
  });

  return (
    <>
      {/* Filter toolbar */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SelectChip
          label="Status"
          icon={Package}
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
          searchable={false}
        />
        <span className="ml-auto text-xs text-text-muted">
          {filtered.length} item{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>
      <DataTable
        rows={filtered}
        rowKey={(s) => s.id}
        bordered={false}
        empty={`No stock recorded${branchName ? ` for ${branchName}` : ""} yet.`}
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Part",
            cell: (s) => <span className="font-medium">{s.item.name}</span>,
          },
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
            align: "right",
            cell: (s) => {
              const low = s.quantity > 0 && s.quantity <= 2;
              const out = s.quantity === 0;
              return (
                <span className="inline-flex items-center justify-end gap-2">
                  {s.quantity}
                  {low && <Badge tone="warning">Low</Badge>}
                  {out && <Badge tone="danger">No Stock</Badge>}
                </span>
              );
            },
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
            align: "right",
            cell: (s) => {
              const out = s.quantity === 0;
              return out ? (
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
              ) : null;
            },
          },
        ]}
      />
    </>
  );
}
