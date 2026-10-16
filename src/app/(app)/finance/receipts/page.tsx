import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { formatDateTime } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { MODE_LABELS } from "@/modules/finance/components/finance-ui";
import { listReceiptsPage } from "@/modules/finance/lists";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Receipts" };

const KIND = { ADVANCE: { label: "Advance", tone: "primary" }, FINAL: { label: "At closing", tone: "success" }, OTHER: { label: "Due collected", tone: "navy" } } as const;

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.receipts);
  const sp = await searchParams;
  const list = listState(FINANCE_PATHS.receipts, sp, { sorts: ["createdAt"] as const, defaultSort: "createdAt" });
  const scope = await getBranchScope(user);
  const { rows, total, tabs } = await listReceiptsPage(list, scope.branchId);

  return (
    <AdminPage title="Receipts" group="Finance" subtitle="Every payment received from customers: advances, payments at closing and dues collected later">
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        tone="blue"
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by customer, case ID, invoice or reference"
        empty="No payments received yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Receipt", cell: (r) => <span className="text-xs font-medium tabular-nums">RC-{r.id.slice(-8).toUpperCase()}</span> },
          { header: "Date", cell: (r) => formatDateTime(r.createdAt) },
          { header: "Customer", cell: (r) => r.customer.name },
          {
            header: "Case ID",
            cell: (r) =>
              r.case ? (
                <Link href={`/service/cases/${r.case.id}`} className="text-sm font-medium text-primary hover:underline">
                  {r.case.jobsheetNo}
                </Link>
              ) : (
                "—"
              ),
          },
          { header: "Invoice", cell: (r) => r.invoice?.invoiceNo ?? <span className="text-text-muted">Not billed yet</span> },
          { header: "Type", cell: (r) => <Badge tone={KIND[r.kind].tone}>{KIND[r.kind].label}</Badge> },
          { header: "Mode", cell: (r) => MODE_LABELS[r.mode] ?? r.mode },
          { header: "Reference", cell: (r) => r.reference ?? "—" },
          { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.branch.code}</span> },
          { header: "Amount ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.amountPaise, { symbol: false })}</span> },
        ]}
      />
    </AdminPage>
  );
}
