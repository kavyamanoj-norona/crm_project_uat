import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { collectInvoicePayment } from "@/modules/finance/actions";
import { PayStatusBadge } from "@/modules/finance/components/finance-ui";
import { PaymentFields } from "@/modules/finance/components/payment-fields";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { customerDues } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

/** Whole days since a date. */
const ageDays = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

export const metadata = { title: "Customer Dues" };

export default async function CustomerDuesPage() {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.pendingDues);
  const scope = await getBranchScope(user);
  const rows = (await customerDues(scope.branchId)).map((r) => ({ ...r, duePaise: r.totalPaise - r.creditedPaise - r.paidPaise })).filter((r) => r.duePaise > 0);
  const total = rows.reduce((s, r) => s + r.duePaise, 0);
  const customers = new Set(rows.map((r) => r.customerId)).size;

  return (
    <AdminPage title="Customer Dues" group="Finance" subtitle="Outstanding amounts on invoices, oldest first">
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="danger" className="px-3 py-1 text-sm tabular-nums">Total due {formatPaise(total)}</Badge>
        <Badge tone="navy" className="px-3 py-1 text-sm">{rows.length} invoices · {customers} customers</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No customer has an outstanding due."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Customer", cell: (r) => <span className="font-medium">{r.customer.name}</span> },
            { header: "Invoice", cell: (r) => <span className="tabular-nums">{r.invoiceNo}</span> },
            {
              header: "Case ID",
              cell: (r) => (
                <Link href={`/service/cases/${r.case.id}`} className="text-sm font-medium text-primary hover:underline">
                  {r.case.jobsheetNo}
                </Link>
              ),
            },
            { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.branch.code}</span> },
            { header: "Invoiced", cell: (r) => formatDate(r.issuedAt) },
            { header: "Age", cell: (r) => { const d = ageDays(r.issuedAt); return <Badge tone={d > 30 ? "danger" : d > 7 ? "warning" : "neutral"}>{d} days</Badge>; } },
            { header: "Total ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.totalPaise, { symbol: false })}</span> },
            { header: "Paid ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.paidPaise, { symbol: false })}</span> },
            { header: "Due ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums text-danger">{formatPaise(r.duePaise, { symbol: false })}</span> },
            { header: "Status", cell: (r) => <PayStatusBadge status={r.paymentStatus} /> },
            {
              header: "Actions",
              align: "center",
              cell: (r) =>
                permission.canEdit ? (
                  <ActionDialog trigger="Collect" triggerVariant="success" triggerSize="sm" title="Collect payment" description={`${r.invoiceNo} · ${r.customer.name} · due ${formatPaise(r.duePaise)}`} action={collectInvoicePayment.bind(null, r.id)} submitLabel="Record payment">
                    <PaymentFields id={`due-${r.id}`} defaultAmount={String(r.duePaise / 100)} />
                  </ActionDialog>
                ) : null,
            },
          ]}
        />
      </div>
    </AdminPage>
  );
}
