import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { postMissing } from "@/modules/finance/actions";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { reconcile } from "@/modules/finance/queries";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Reconciliation" };

export default async function ReconciliationPage() {
  const { permission } = await requirePageAccess(FINANCE_PATHS.reconciliation);
  const r = await reconcile();
  const missing = Object.values(r.missing).reduce((s, n) => s + n, 0);

  const checks = [
    { check: "Total debits equal total credits", books: r.debit, records: r.credit, ok: r.debit === r.credit },
    { check: "Accounts Receivable equals customer dues on invoices", books: r.receivable, records: r.dueInvoices, ok: r.receivable === r.dueInvoices },
    { check: "Accounts Payable equals supplier dues on purchase bills", books: r.payable, records: r.dueBills, ok: r.payable === r.dueBills },
    { check: "Invoices not yet in the ledger", books: 0, records: r.missing.invoices, count: true, ok: r.missing.invoices === 0 },
    { check: "Customer payments not yet in the ledger", books: 0, records: r.missing.payments, count: true, ok: r.missing.payments === 0 },
    { check: "Purchase bills not yet in the ledger", books: 0, records: r.missing.bills, count: true, ok: r.missing.bills === 0 },
    { check: "Supplier payments not yet in the ledger", books: 0, records: r.missing.billPayments, count: true, ok: r.missing.billPayments === 0 },
    { check: "Bank receipts and payments still booked on a branch, not the Head Office bank", books: 0, records: r.missing.bankAtBranch, count: true, ok: r.missing.bankAtBranch === 0 },
    { check: "Direct sales not yet in the ledger", books: 0, records: r.missing.sales, count: true, ok: r.missing.sales === 0 },
  ];

  return (
    <AdminPage
      title="Reconciliation"
      group="Finance"
      subtitle="Checks that the ledger agrees with the invoices, bills and payments. Anything missing can be posted in one click; each record is posted once only."
      actions={
        permission.canEdit &&
        missing > 0 && (
          <ActionButton action={postMissing} label="Post missing entries" className={buttonClass("primary")}>
            Post {missing} missing {missing === 1 ? "entry" : "entries"}
          </ActionButton>
        )
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        {checks.every((c) => c.ok) ? <Badge tone="success" className="px-3 py-1 text-sm">Everything reconciles</Badge> : <Badge tone="warning" className="px-3 py-1 text-sm">{checks.filter((c) => !c.ok).length} check(s) need attention</Badge>}
        <Badge tone="neutral" className="px-3 py-1 text-sm tabular-nums">Advances held {formatPaise(r.advanceLedger)} of {formatPaise(r.advancesTaken)} taken</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={checks}
          rowKey={(c) => c.check}
          columns={[
            { header: "Check", cell: (c) => c.check },
            { header: "Books", align: "right", cell: (c) => <span className="tabular-nums">{c.count ? "—" : formatPaise(c.books)}</span> },
            { header: "Records", align: "right", cell: (c) => <span className="tabular-nums">{c.count ? c.records : formatPaise(c.records)}</span> },
            { header: "Result", cell: (c) => (c.ok ? <Badge tone="success">OK</Badge> : <Badge tone="danger">Needs attention</Badge>) },
          ]}
        />
      </div>
    </AdminPage>
  );
}
