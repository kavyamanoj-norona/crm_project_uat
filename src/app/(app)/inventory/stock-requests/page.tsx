import Link from "next/link";
import { Eye } from "lucide-react";
import { db } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { FlashToast } from "@/components/feedback/flash-toast";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDate } from "@/lib/dates";
import { listState } from "@/lib/list";
import { param } from "@/modules/admin/components/admin-page";
import { createStockRequestAction } from "@/modules/inventory/actions/stock-request";
import { StockRequestDialog } from "@/modules/inventory/components/stock-request-dialog";
import { INVENTORY_PATHS } from "@/modules/inventory/paths";
import { STOCK_REQUEST_SORTS, listStockRequests } from "@/modules/inventory/stock-request-queries";
import { stockRequestStatus } from "@/modules/inventory/stock-request-status";
import { getBranchScope, branchWhere } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Stock Requests" };

export default async function StockRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(INVENTORY_PATHS.stockRequests);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const list = listState(INVENTORY_PATHS.stockRequests, sp, { sorts: STOCK_REQUEST_SORTS, defaultSort: "createdAt" });

  // Only branch users send requests; anyone else with access (admin) can look.
  const canCreate = permission.canCreate && user.privilege.isBranchBound && Boolean(user.branchId);
  const [{ rows, total }, items] = await Promise.all([
    listStockRequests(list, branchWhere(scope)),
    canCreate
      ? db.item.findMany({ where: { isActive: true, type: { in: ["PART", "ACCESSORY"] } }, orderBy: { name: "asc" }, select: { id: true, code: true, name: true } })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <FlashToast flag={param(sp, "saved")} message="Request sent to Head Office." />
      <PageHeader
        title={`Stock requests${scope.branch ? ` — ${scope.branch.name}` : " — all branches"}`}
        subtitle="Ask Head Office for spare parts and accessories; follow each request through ordering and transfer"
        breadcrumbs={["Inventory", "Stock Requests"]}
        actions={canCreate ? <StockRequestDialog items={items.map((i) => ({ value: i.id, label: `${i.name} (${i.code})` }))} action={createStockRequestAction} /> : undefined}
      />
      <ListView
        list={list}
        total={total}
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by request ID or item"
        empty="No stock requests yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          {
            header: "Request ID",
            sort: "code",
            cell: (r) => (
              <Link href={`${INVENTORY_PATHS.stockRequests}/${r.id}`} className="font-semibold text-brand-navy hover:text-primary dark:text-text">
                {r.code}
              </Link>
            ),
          },
          { header: "Date", sort: "createdAt", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
          ...(scope.branchId ? [] : [{ header: "Branch", cell: (r: (typeof rows)[number]) => r.branch.code }]),
          {
            header: "Items",
            cell: (r) => (
              <span className="flex max-w-md flex-col whitespace-normal leading-tight">
                {r.lines.map((l) => (
                  <span key={l.id} className="text-sm">
                    {l.item.name} <span className="text-text-muted">× {l.quantity}</span>
                  </span>
                ))}
              </span>
            ),
          },
          { header: "Total qty", align: "right", cell: (r) => <span className="tabular-nums">{r.lines.reduce((s, l) => s + l.quantity, 0)}</span> },
          {
            header: "Status",
            cell: (r) => {
              const s = stockRequestStatus(r.lines);
              return <Badge tone={s.tone}>{s.label}</Badge>;
            },
          },
          { header: "Requested by", cell: (r) => personName(r.requestedBy) ?? "—" },
          {
            header: "Action",
            align: "center",
            cell: (r) => (
              <Link href={`${INVENTORY_PATHS.stockRequests}/${r.id}`} aria-label={`View ${r.code}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10">
                <Eye className="size-3.5" />
                View
              </Link>
            ),
          },
        ]}
      />
    </>
  );
}
