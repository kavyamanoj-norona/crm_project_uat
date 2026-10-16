import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addTransfer } from "@/modules/finance/actions";
import { MODE_LABELS } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { db } from "@/server/db";
import { listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Inter-branch Transfers" };

export default async function TransfersPage() {
  const { permission } = await requirePageAccess(FINANCE_PATHS.transfers);
  const [entries, branches] = await Promise.all([
    db.journalEntry.findMany({
      where: { sourceType: "TRANSFER" },
      orderBy: { entryDate: "desc" },
      take: 200,
      include: { lines: { include: { account: { select: { code: true } }, branch: { select: { code: true, name: true } } } } },
    }),
    listBranchOptions(),
  ]);
  const rows = entries.map((e) => {
    const out = e.lines.find((l) => l.creditPaise > 0 && l.account.code !== "1400")!;
    const into = e.lines.find((l) => l.debitPaise > 0 && l.account.code !== "1400")!;
    return { id: e.id, entryNo: e.entryNo, date: e.entryDate, from: out.branch.code, to: into.branch.code, mode: out.account.code === "1000" ? "CASH" : "BANK_TRANSFER", amount: out.creditPaise, narration: e.narration };
  });
  const options = branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }));

  return (
    <AdminPage
      title="Inter-branch Transfers"
      group="Finance"
      subtitle="Cash or bank money moved between branches and Head Office. Each branch's own books stay balanced through the inter-branch account."
      actions={
        permission.canCreate && (
          <ActionDialog trigger="New transfer" triggerVariant="primary" title="New inter-branch transfer" action={addTransfer} submitLabel="Record transfer">
            <Field label="From branch" htmlFor="tr-from" required>
              <Select id="tr-from" name="fromBranchId" placeholder="Select sending branch" options={options} />
            </Field>
            <Field label="To branch" htmlFor="tr-to" required>
              <Select id="tr-to" name="toBranchId" placeholder="Select receiving branch" options={options} />
            </Field>
            <Field label="Amount (₹)" htmlFor="tr-amount" required>
              <Input id="tr-amount" name="amount" inputMode="decimal" placeholder="Enter amount" />
            </Field>
            <Field label="Cash or bank" htmlFor="tr-mode" required>
              <Select id="tr-mode" name="mode" placeholder="Select cash or bank" options={[{ value: "CASH", label: "Cash" }, { value: "BANK_TRANSFER", label: "Bank" }]} />
            </Field>
            <Field label="Remarks" htmlFor="tr-remarks">
              <Textarea id="tr-remarks" name="remarks" rows={2} placeholder="Enter remarks" />
            </Field>
          </ActionDialog>
        )
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No transfers yet."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Date", cell: (r) => formatDate(r.date) },
            { header: "Entry", cell: (r) => <span className="text-xs tabular-nums">{r.entryNo}</span> },
            { header: "From", cell: (r) => <span className="font-medium">{r.from}</span> },
            { header: "To", cell: (r) => <span className="font-medium">{r.to}</span> },
            { header: "Mode", cell: (r) => MODE_LABELS[r.mode] },
            { header: "Details", cell: (r) => <p className="max-w-72 truncate text-sm" title={r.narration}>{r.narration}</p> },
            { header: "Amount ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.amount, { symbol: false })}</span> },
          ]}
        />
      </div>
    </AdminPage>
  );
}
