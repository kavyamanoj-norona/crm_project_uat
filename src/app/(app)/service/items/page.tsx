import { db } from "@/server/db";
import { ActiveBadge, Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { WhoWhen } from "@/components/data/who-when";
import { listState } from "@/lib/list";
import { formatPaise, paiseToInput } from "@/lib/money";
import { minPricePaise } from "@/lib/pricing";
import { saveItem } from "@/modules/admin/actions/save";
import { toggleActive } from "@/modules/admin/actions/toggle";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { EntityForm, type FieldConfig } from "@/modules/admin/components/entity-form";
import { RowActions } from "@/modules/admin/components/row-actions";
import { ITEM_TYPE_LABELS, ITEM_TYPE_TONE, gstOptions, itemTypeOptions, unitOptions } from "@/modules/admin/item-schema";
import { ITEM_SORTS, listItemCategories, listItems } from "@/modules/admin/queries";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { RULES, getNumberRule } from "@/server/rules";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Items" };


export default async function ItemsPage({ searchParams }: PageProps<"/service/items">) {
  const { permission } = await requirePageAccess(SERVICE_PATHS.items);
  const sp = await searchParams;
  const list = listState(SERVICE_PATHS.items, sp, { sorts: ITEM_SORTS, defaultSort: "name", defaultDir: "asc" });
  const editId = param(sp, "edit");

  const [{ rows, total, tabs }, editing, categories, discountCap] = await Promise.all([
    listItems(list),
    editId && permission.canEdit ? db.item.findUnique({ where: { id: editId } }) : null,
    listItemCategories(),
    getNumberRule(RULES.discountCapPercent, 10),
  ]);

  const fields: FieldConfig[] = [
    { name: "code", label: "Item code", required: true, placeholder: "Enter item code", hint: "Unique; printed on estimates" },
    { name: "name", label: "Name", required: true, placeholder: "Enter item name", span: 2 },
    { name: "type", label: "Type", type: "select", required: true, options: itemTypeOptions },
    { name: "category", label: "Category", placeholder: "Enter categories", suggestions: categories },
    { name: "brand", label: "Brand", placeholder: "Enter applicable brands" },
    { name: "unit", label: "Unit", type: "select", required: true, options: unitOptions },
    { name: "hsnSac", label: "HSN / SAC", placeholder: "Enter HSN code", hint: "For GST invoices" },
    { name: "price", label: "Selling price ₹", required: true, placeholder: "Enter price", hint: "Per unit, as billed" },
    { name: "maxDiscountPercent", label: "Max discount %", type: "number", required: true, hint: "Staff can't bill below this" },
    { name: "gstPercent", label: "GST rate", type: "select", required: true, options: gstOptions },
    { name: "warrantyDays", label: "Warranty (days)", type: "number", placeholder: "Enter value" },
    { name: "description", label: "Description", type: "textarea", span: 3 },
    { name: "isActive", label: "Active (can be picked on cases)", type: "switch" },
  ];

  const initial = editing
    ? { ...editing, price: paiseToInput(editing.pricePaise) }
    : { type: "SERVICE", unit: "Nos", gstPercent: 18, maxDiscountPercent: discountCap, isActive: true };

  return (
    <AdminPage
      title="Items"
      group="Service"
      subtitle="Services, spare parts and accessories that can be added to a case at diagnosis"
      saved={param(sp, "saved")}
      form={
        (editing ? permission.canEdit : permission.canCreate)
          ? {
              label: "Add Item",
              editingTitle: editing ? `${editing.name} (${editing.code})` : undefined,
              cancelHref: SERVICE_PATHS.items,
              content: <EntityForm fields={fields} schema="item" action={saveItem} id={editing?.id} initial={initial} />,
            }
          : undefined
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        highlight={(r) => r.id === editing?.id}
        searchPlaceholder="Search code, name, category, HSN…"
        empty="No items yet. Add the services and parts you bill for."
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
          { header: "Max disc.", sort: "maxDiscountPercent", align: "right", cell: (r) => `${r.maxDiscountPercent}%` },
          {
            header: "Min price",
            align: "right",
            cell: (r) => <span className="tabular-nums">{formatPaise(minPricePaise(r.pricePaise, r.maxDiscountPercent))}</span>,
          },
          { header: "GST", align: "right", cell: (r) => `${r.gstPercent}%` },
          { header: "HSN/SAC", cell: (r) => r.hsnSac ?? "—" },
          { header: "Unit", cell: (r) => r.unit },
          { header: "Warranty", cell: (r) => (r.warrantyDays ? `${r.warrantyDays} days` : "—") },
          { header: "Last updated", sort: "updatedAt", cell: (r) => <WhoWhen by={r.updatedBy} at={r.updatedAt} /> },
          { header: "Status", cell: (r) => <ActiveBadge active={r.isActive} /> },
          {
            header: "Action",
            cell: (r) =>
              permission.canEdit && (
                <RowActions
                  editHref={`${SERVICE_PATHS.items}?edit=${r.id}`}
                  toggle={toggleActive.bind(null, "item", r.id)}
                  active={r.isActive}
                />
              ),
          },
        ]}
      />
    </AdminPage>
  );
}
