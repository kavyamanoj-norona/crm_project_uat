import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { paySupplierBill } from "@/modules/finance/actions";
import { PayStatusBadge } from "@/modules/finance/components/finance-ui";
import { PaymentFields } from "@/modules/finance/components/payment-fields";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { supplierPayables } from "@/modules/finance/queries";
import { requirePageAccess } from "@/server/rbac/guard";

/** Whole days since a date. */
const ageDays = (d: Date) => Math.floor((Date.now() - d.getTime()) / 86_400_000);

export const metadata = { title: "Supplier Payables" };

export default async function PayablesPage() {
  const { permission } = await requirePageAccess(FINANCE_PATHS.payables);
  const rows = await supplierPayables();
  const total = rows.reduce((s, r) => s + r.duePaise, 0);
  const suppliers = new Set(rows.map((r) => r.supplierId)).size;

  return (
    <AdminPage title="Supplier Payables" group="Finance" subtitle="Purchase bills from suppliers that are not fully paid. Paying one posts to the supplier account and the bank or cash book.">
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="danger" className="px-3 py-1 text-sm tabular-nums">Total payable {formatPaise(total)}</Badge>
        <Badge tone="navy" className="px-3 py-1 text-sm">{rows.length} bills · {suppliers} suppliers</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No supplier bill is waiting for payment."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Supplier", cell: (r) => <span className="font-medium">{r.supplier.name}</span> },
            { header: "Bill", cell: (r) => <span className="tabular-nums">{r.billNo}</span> },
            { header: "Code", cell: (r) => <span className="text-xs text-text-muted tabular-nums">{r.code}</span> },
            { header: "Bill date", cell: (r) => formatDate(r.billDate) },
            { header: "Age", cell: (r) => { const d = ageDays(r.billDate); return <Badge tone={d > 30 ? "danger" : d > 7 ? "warning" : "neutral"}>{d} days</Badge>; } },
            { header: "Total ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.totalPaise, { symbol: false })}</span> },
            { header: "Paid ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.paidPaise, { symbol: false })}</span> },
            { header: "Due ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums text-danger">{formatPaise(r.duePaise, { symbol: false })}</span> },
            { header: "Status", cell: (r) => <PayStatusBadge status={r.paymentStatus} /> },
            {
              header: "Actions",
              align: "center",
              cell: (r) =>
                permission.canEdit ? (
                  <ActionDialog trigger="Pay" triggerVariant="success" triggerSize="sm" title="Pay supplier" description={`${r.supplier.name} · bill ${r.billNo} · due ${formatPaise(r.duePaise)}`} action={paySupplierBill.bind(null, r.id)} submitLabel="Record payment">
                    <PaymentFields id={`pay-${r.id}`} amountLabel="Amount paid (₹)" defaultAmount={String(r.duePaise / 100)} />
                  </ActionDialog>
                ) : null,
            },
          ]}
        />
      </div>
    </AdminPage>
  );
}
