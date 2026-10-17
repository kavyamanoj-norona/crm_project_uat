import Link from "next/link";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { ListView } from "@/components/data/list-view";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { AdminPage, param } from "@/modules/admin/components/admin-page";
import { BILL_SORTS, listBills } from "@/modules/inventory/billing-queries";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Billing" };

const BILL_STATUS: Record<string, { label: string; tone: "danger" | "warning" | "success" }> = {
  UNPAID: { label: "Unpaid", tone: "danger" },
  PARTIAL: { label: "Part paid", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
};

export default async function BillingPage({ searchParams }: PageProps<"/inventory/billing">) {
  const { permission } = await requirePageAccess(INVENTORY_PATHS.billing);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.billing, sp, { sorts: BILL_SORTS, defaultSort: "createdAt" });
  const { rows, total, tabs } = await listBills(list);

  return (
    <AdminPage
      title="Billing"
      group="Inventory"
      subtitle="Supplier purchase bills. Saving a bill adds its items to Head Office stock and records the payment."
      saved={param(sp, "saved")}
      actions={
        permission.canCreate && (
          <LinkButton href={`${INVENTORY_PATHS.billing}/new`}>
            <Plus className="size-4" /> New bill
          </LinkButton>
        )
      }
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by bill number, supplier or code"
        empty="No purchase bills yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 + (list.page - 1) * list.pageSize },
          {
            header: "Bill",
            cell: (r) => (
              <span className="flex items-center gap-2">
                <Link href={`${INVENTORY_PATHS.billing}/${r.id}`} className="font-medium text-primary hover:underline">
                  {r.billNo}
                </Link>
                {r.isOfficeUse && <Badge tone="violet">Office use{r.officePurpose ? ` · ${r.officePurpose}` : ""}</Badge>}
              </span>
            ),
          },
          { header: "Code", cell: (r) => <span className="text-xs text-text-muted tabular-nums">{r.code}</span> },
          { header: "Supplier", cell: (r) => r.supplier.name },
          { header: "Bill date", sort: "billDate", cell: (r) => formatDate(r.billDate) },
          { header: "Items", align: "center", cell: (r) => r._count.items },
          { header: "Total", sort: "totalPaise", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.totalPaise)}</span> },
          { header: "Paid", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.paidPaise)}</span> },
          {
            header: "Due",
            align: "right",
            cell: (r) => <span className="tabular-nums">{formatPaise(r.totalPaise - r.paidPaise)}</span>,
          },
          {
            header: "Status",
            cell: (r) => <Badge tone={BILL_STATUS[r.paymentStatus]!.tone}>{BILL_STATUS[r.paymentStatus]!.label}</Badge>,
          },
          { header: "Created on", sort: "createdAt", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Created by", cell: (r) => (r.createdBy ? `${r.createdBy.firstName} ${r.createdBy.lastName ?? ""}`.trim() : "—") },
        ]}
      />
    </AdminPage>
  );
}
