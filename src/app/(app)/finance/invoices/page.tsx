import Link from "next/link";
import { ListView } from "@/components/data/list-view";
import { ActionDialog } from "@/components/forms/action-dialog";
import { formatDate } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { collectInvoicePayment } from "@/modules/finance/actions";
import { PayStatusBadge } from "@/modules/finance/components/finance-ui";
import { PaymentFields } from "@/modules/finance/components/payment-fields";
import { listInvoicesPage } from "@/modules/finance/lists";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.invoices);
  const sp = await searchParams;
  const list = listState(FINANCE_PATHS.invoices, sp, { sorts: ["issuedAt"] as const, defaultSort: "issuedAt" });
  const scope = await getBranchScope(user);
  const { rows, total, tabs } = await listInvoicesPage(list, scope.branchId);

  return (
    <AdminPage title="Invoices" group="Finance" subtitle="Final bills generated when a case is closed, with what is paid and what is still due">
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        tone="blue"
        rows={rows}
        rowKey={(r) => r.id}
        searchPlaceholder="Search by invoice, customer or case ID"
        empty="No invoices yet. An invoice is created when a case is closed."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Invoice", cell: (r) => <span className="font-medium tabular-nums">{r.invoiceNo}</span> },
          { header: "Date", cell: (r) => formatDate(r.issuedAt) },
          {
            header: "Case ID",
            cell: (r) => (
              <Link href={`/service/cases/${r.case.id}`} className="text-sm font-medium text-primary hover:underline">
                {r.case.jobsheetNo}
              </Link>
            ),
          },
          { header: "Customer", cell: (r) => r.customer.name },
          { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.branch.code}</span> },
          { header: "Taxable ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.subtotalPaise, { symbol: false })}</span> },
          { header: "GST ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.taxPaise, { symbol: false })}</span> },
          { header: "Total ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.totalPaise, { symbol: false })}</span> },
          { header: "Credited ₹", align: "right", cell: (r) => <span className="tabular-nums">{r.creditedPaise ? formatPaise(r.creditedPaise, { symbol: false }) : "—"}</span> },
          { header: "Paid ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.paidPaise, { symbol: false })}</span> },
          {
            header: "Due ₹",
            align: "right",
            cell: (r) => {
              const due = r.totalPaise - r.creditedPaise - r.paidPaise;
              return <span className={`font-semibold tabular-nums ${due > 0 ? "text-danger" : ""}`}>{formatPaise(due, { symbol: false })}</span>;
            },
          },
          { header: "Status", cell: (r) => <PayStatusBadge status={r.paymentStatus} /> },
          {
            header: "Actions",
            align: "center",
            cell: (r) => {
              const due = r.totalPaise - r.creditedPaise - r.paidPaise;
              return due > 0 && permission.canEdit ? (
                <ActionDialog
                  trigger="Collect payment"
                  triggerVariant="success"
                  triggerSize="sm"
                  title="Collect payment"
                  description={`${r.invoiceNo} · ${r.customer.name} · due ${formatPaise(due)}`}
                  action={collectInvoicePayment.bind(null, r.id)}
                  submitLabel="Record payment"
                >
                  <PaymentFields id={`inv-${r.id}`} defaultAmount={String(due / 100)} />
                </ActionDialog>
              ) : null;
            },
          },
        ]}
      />
    </AdminPage>
  );
}
