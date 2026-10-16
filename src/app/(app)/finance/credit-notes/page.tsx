import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { SearchSelectField } from "@/components/forms/search-select";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addCreditNote } from "@/modules/finance/actions";
import { MODE_LABELS } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { db } from "@/server/db";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Credit Notes" };

export default async function CreditNotesPage() {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.creditNotes);
  const scope = await getBranchScope(user);
  const branch = scope.branchId ? { branchId: scope.branchId } : {};
  const [notes, invoices] = await Promise.all([
    db.creditNote.findMany({
      where: { invoice: branch },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { invoice: { select: { invoiceNo: true, customer: { select: { name: true } }, branch: { select: { code: true } } } } },
    }),
    permission.canCreate ? db.caseInvoice.findMany({ where: branch, orderBy: { issuedAt: "desc" }, take: 500, select: { id: true, invoiceNo: true, totalPaise: true, creditedPaise: true, paidPaise: true, customer: { select: { name: true } } } }) : Promise.resolve([]),
  ]);
  const creditable = invoices.filter((i) => i.totalPaise - i.creditedPaise > 0);

  return (
    <AdminPage
      title="Credit Notes"
      group="Finance"
      subtitle="Reduce an invoice after a return or a price correction. The income and GST are reduced, and any amount already paid is refunded."
      actions={
        permission.canCreate && (
          <ActionDialog trigger="New credit note" triggerVariant="primary" title="New credit note" description="The amount includes GST. It reduces what the customer owes; anything above the current due is refunded." action={addCreditNote} submitLabel="Create credit note">
            <Field label="Invoice" htmlFor="cn-invoice" required>
              <SearchSelectField id="cn-invoice" name="invoiceId" placeholder="Select invoice" options={creditable.map((i) => ({ value: i.id, label: `${i.invoiceNo} · ${i.customer.name} · ${formatPaise(i.totalPaise - i.creditedPaise)}` }))} />
            </Field>
            <Field label="Credit amount (₹, incl. GST)" htmlFor="cn-amount" required>
              <Input id="cn-amount" name="amount" inputMode="decimal" placeholder="Enter amount" />
            </Field>
            <Field label="Reason" htmlFor="cn-reason" required>
              <Textarea id="cn-reason" name="reason" rows={2} placeholder="Enter reason" />
            </Field>
            <Field label="Refund mode" htmlFor="cn-mode" hint="Only needed when part of the amount was already paid and goes back to the customer.">
              <Select id="cn-mode" name="mode" placeholder="Select refund mode" options={["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((m) => ({ value: m, label: MODE_LABELS[m]! }))} />
            </Field>
          </ActionDialog>
        )
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={notes}
          rowKey={(n) => n.id}
          empty="No credit notes yet."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Credit note", cell: (n) => <span className="font-medium tabular-nums">{n.noteNo}</span> },
            { header: "Date", cell: (n) => formatDate(n.createdAt) },
            { header: "Invoice", cell: (n) => n.invoice.invoiceNo },
            { header: "Customer", cell: (n) => n.invoice.customer.name },
            { header: "Branch", cell: (n) => <span className="text-xs text-text-muted">{n.invoice.branch.code}</span> },
            { header: "Reason", cell: (n) => <p className="max-w-56 truncate text-sm" title={n.reason}>{n.reason}</p> },
            { header: "GST ₹", align: "right", cell: (n) => <span className="tabular-nums">{formatPaise(n.taxPaise, { symbol: false })}</span> },
            { header: "Amount ₹", align: "right", cell: (n) => <span className="font-semibold tabular-nums">{formatPaise(n.amountPaise, { symbol: false })}</span> },
            { header: "Refunded", cell: (n) => (n.refundPaise > 0 ? <Badge tone="warning">{formatPaise(n.refundPaise)} · {MODE_LABELS[n.refundMode ?? "OTHER"]}</Badge> : "—") },
          ]}
        />
      </div>
    </AdminPage>
  );
}
