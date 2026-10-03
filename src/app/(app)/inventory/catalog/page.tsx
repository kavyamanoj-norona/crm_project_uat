import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { ITEM_TYPE_LABELS, ITEM_TYPE_TONE } from "@/modules/admin/item-schema";
import { ITEM_SORTS, listItems } from "@/modules/admin/queries";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Catalog" };

export default async function CatalogPage({ searchParams }: PageProps<"/inventory/catalog">) {
  await requirePageAccess(INVENTORY_PATHS.catalog);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.catalog, sp, { sorts: ITEM_SORTS, defaultSort: "name", defaultDir: "asc" });
  const { rows, total, tabs } = await listItems(list);

  return (
    <AdminPage title="Catalog" group="Inventory" subtitle="Read-only view of all service items and spare parts">
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search code, name, category…"
        empty="No items in the catalog yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Code", sort: "code", cell: (r) => <span className="font-medium">{r.code}</span> },
          {
            header: "Name",
            sort: "name",
            cell: (r) => (
              <span className="flex items-center gap-2">
                {r.name}
                <Badge tone={ITEM_TYPE_TONE[r.type]}>{ITEM_TYPE_LABELS[r.type]}</Badge>
              </span>
            ),
          },
          { header: "Category", sort: "category", cell: (r) => r.category ?? "—" },
          { header: "Brand", cell: (r) => r.brand ?? "—" },
          { header: "Price", sort: "pricePaise", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.pricePaise)}</span> },
          { header: "Min price", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(minPricePaise(r.pricePaise, r.maxDiscountPercent))}</span> },
          { header: "GST", align: "right", cell: (r) => `${r.gstPercent}%` },
          { header: "Unit", cell: (r) => r.unit },
        ]}
      />
    </AdminPage>
  );
}
