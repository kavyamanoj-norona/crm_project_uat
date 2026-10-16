import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { formatDate, todayIst } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addExpense } from "@/modules/finance/actions";
import { DateFilter, MODE_LABELS } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { parseRange } from "@/modules/finance/queries";
import { db } from "@/server/db";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.expenses);
  const sp = await searchParams;
  const range = parseRange(sp);
  const scope = await getBranchScope(user);
  const [entries, categories, branches] = await Promise.all([
    db.journalEntry.findMany({
      where: { sourceType: "EXPENSE", entryDate: { gte: range.from, lt: range.to }, ...(scope.branchId ? { lines: { some: { branchId: scope.branchId } } } : {}) },
      orderBy: { entryDate: "desc" },
      take: 500,
      include: { lines: { include: { account: { select: { code: true, name: true, type: true } }, branch: { select: { code: true } } } } },
    }),
    db.account.findMany({ where: { type: "EXPENSE", isActive: true, subType: "EXPENSE" }, orderBy: { code: "asc" }, select: { id: true, name: true } }),
    permission.canCreate && !scope.branchId ? listBranchOptions() : Promise.resolve([]),
  ]);
  const rows = entries.map((e) => {
    const exp = e.lines.find((l) => l.account.type === "EXPENSE")!;
    const pay = e.lines.find((l) => l.account.type !== "EXPENSE")!;
    return { id: e.id, entryNo: e.entryNo, date: e.entryDate, narration: e.narration, category: exp.account.name, branch: exp.branch.code, paidFrom: pay.account.code === "1000" ? "Cash" : "Bank", amount: exp.debitPaise };
  });
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <AdminPage
      title="Expenses"
      group="Finance"
      subtitle="Running costs of the branches and Head Office. Each expense is posted to the books and reduces cash or bank."
      actions={
        permission.canCreate && (
          <ActionDialog trigger="Add expense" triggerVariant="primary" title="Add expense" action={addExpense} submitLabel="Record expense">
            <Field label="Date" htmlFor="ex-date" required>
              <Input id="ex-date" type="date" name="date" defaultValue={todayIst()} max={todayIst()} />
            </Field>
            {!scope.branchId && (
              <Field label="Branch" htmlFor="ex-branch" required>
                <Select id="ex-branch" name="branchId" placeholder="Select branch" options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))} />
              </Field>
            )}
            <Field label="Category" htmlFor="ex-cat" required>
              <Select id="ex-cat" name="accountId" placeholder="Select category" options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            </Field>
            <Field label="Amount (₹)" htmlFor="ex-amount" required>
              <Input id="ex-amount" name="amount" inputMode="decimal" placeholder="Enter amount" />
            </Field>
            <Field label="Paid from" htmlFor="ex-mode" required>
              <Select id="ex-mode" name="mode" placeholder="Select payment mode" options={["CASH", "UPI", "CARD", "BANK_TRANSFER"].map((m) => ({ value: m, label: MODE_LABELS[m]! }))} />
            </Field>
            <Field label="Remarks" htmlFor="ex-remarks">
              <Textarea id="ex-remarks" name="remarks" rows={2} placeholder="Enter remarks" />
            </Field>
          </ActionDialog>
        )
      }
    >
      <DateFilter from={range.fromStr} to={range.toStr} />
      <div className="mb-4">
        <Badge tone="danger" className="px-3 py-1 text-sm tabular-nums">Total expenses {formatPaise(total)}</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No expenses in this period."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Date", cell: (r) => formatDate(r.date) },
            { header: "Entry", cell: (r) => <span className="text-xs tabular-nums">{r.entryNo}</span> },
            { header: "Category", cell: (r) => r.category },
            { header: "Branch", cell: (r) => <span className="text-xs text-text-muted">{r.branch}</span> },
            { header: "Details", cell: (r) => <p className="max-w-72 truncate text-sm" title={r.narration}>{r.narration}</p> },
            { header: "Paid from", cell: (r) => r.paidFrom },
            { header: "Amount ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.amount, { symbol: false })}</span> },
          ]}
        />
      </div>
    </AdminPage>
  );
}
