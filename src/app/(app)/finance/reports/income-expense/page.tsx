import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { DateFilter } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { parseRange, profitAndLoss } from "@/modules/finance/queries";
import { db } from "@/server/db";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Income & Expense" };

/** Branch-wise income, expense and profit side by side, with the Head Office consolidated total. */
export default async function IncomeExpensePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.reportsIncomeExpense);
  const sp = await searchParams;
  const range = parseRange(sp);
  const scope = await getBranchScope(user);
  const branches = await db.branch.findMany({ where: { isActive: true, ...(scope.branchId ? { id: scope.branchId } : {}) }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } });
  const rows = await Promise.all(
    branches.map(async (b) => {
      const pl = await profitAndLoss(b.id, range);
      return { id: b.id, label: `${b.code} — ${b.name}`, income: pl.totalIncome, expense: pl.totalExpense, profit: pl.profit };
    }),
  );
  const total = rows.reduce((s, r) => ({ income: s.income + r.income, expense: s.expense + r.expense, profit: s.profit + r.profit }), { income: 0, expense: 0, profit: 0 });
  const withTotal = [...rows, { id: "total", label: scope.branchId ? "Total" : "Head Office (consolidated)", ...total }];

  return (
    <AdminPage title="Income & Expense" group="Finance" subtitle="Income, expenses and profit of every branch for the period, with the consolidated total">
      <DateFilter from={range.fromStr} to={range.toStr} />
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={withTotal}
          rowKey={(r) => r.id}
          empty="No branches."
          columns={[
            { header: "Branch", cell: (r) => <span className={r.id === "total" ? "font-bold" : "font-medium"}>{r.label}</span> },
            { header: "Income ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.income, { symbol: false })}</span> },
            { header: "Expenses ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.expense, { symbol: false })}</span> },
            { header: "Profit / Loss ₹", align: "right", cell: (r) => <span className={`font-semibold tabular-nums ${r.profit < 0 ? "text-danger" : ""}`}>{formatPaise(r.profit, { symbol: false })}</span> },
            { header: "Result", align: "center", cell: (r) => (r.income === 0 && r.expense === 0 ? "—" : r.profit >= 0 ? <Badge tone="success">Profit</Badge> : <Badge tone="danger">Loss</Badge>) },
          ]}
        />
      </div>
    </AdminPage>
  );
}
