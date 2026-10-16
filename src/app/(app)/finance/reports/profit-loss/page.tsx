import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { DateFilter, Line } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { parseRange, profitAndLoss } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Profit & Loss" };

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.reportsProfitLoss);
  const sp = await searchParams;
  const range = parseRange(sp);
  const scope = await getBranchScope(user);
  const pl = await profitAndLoss(scope.branchId, range);

  return (
    <AdminPage title="Profit & Loss" group="Finance" subtitle={`${scope.branch ? `${scope.branch.name} branch` : "All branches (consolidated)"} · income less expenses for the period`}>
      <DateFilter from={range.fromStr} to={range.toStr} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="success" className="px-3 py-1 text-sm tabular-nums">Income {formatPaise(pl.totalIncome)}</Badge>
        <Badge tone="danger" className="px-3 py-1 text-sm tabular-nums">Expenses {formatPaise(pl.totalExpense)}</Badge>
        <Badge tone={pl.profit >= 0 ? "primary" : "warning"} className="px-3 py-1 text-sm tabular-nums">{pl.profit >= 0 ? "Profit" : "Loss"} {formatPaise(Math.abs(pl.profit))}</Badge>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Income">
          <dl>
            {pl.income.length === 0 && <p className="text-sm text-text-muted">No income in this period.</p>}
            {pl.income.map((r) => (
              <Line key={r.id} label={`${r.code} · ${r.name}`} value={formatPaise(r.amount)} />
            ))}
            <Line label="Total income" value={formatPaise(pl.totalIncome)} strong />
          </dl>
        </Card>
        <Card title="Expenses">
          <dl>
            {pl.expense.length === 0 && <p className="text-sm text-text-muted">No expenses in this period.</p>}
            {pl.expense.map((r) => (
              <Line key={r.id} label={`${r.code} · ${r.name}`} value={formatPaise(r.amount)} />
            ))}
            <Line label="Total expenses" value={formatPaise(pl.totalExpense)} strong />
          </dl>
        </Card>
      </div>
      <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-3">
        <Line label={pl.profit >= 0 ? "Net profit" : "Net loss"} value={formatPaise(Math.abs(pl.profit))} strong tone={pl.profit >= 0 ? "pos" : "neg"} />
      </div>
    </AdminPage>
  );
}
