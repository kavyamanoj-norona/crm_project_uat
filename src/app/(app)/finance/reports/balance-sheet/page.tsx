import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { DateFilter, Line } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { balanceSheet, parseRange } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Balance Sheet" };

export default async function BalanceSheetPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.reportsBalanceSheet);
  const sp = await searchParams;
  const range = parseRange(sp);
  const scope = await getBranchScope(user);
  const bs = await balanceSheet(scope.branchId, new Date(`${range.toStr}T00:00:00+05:30`));

  return (
    <AdminPage title="Balance Sheet" group="Finance" subtitle={`${scope.branch ? `${scope.branch.name} branch` : "All branches (consolidated)"} · what the business owns and owes as at ${range.toStr}`}>
      <DateFilter from="" to={range.toStr} single />
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="primary" className="px-3 py-1 text-sm tabular-nums">Assets {formatPaise(bs.totalAssets)}</Badge>
        <Badge tone="warning" className="px-3 py-1 text-sm tabular-nums">Liabilities + equity {formatPaise(bs.totalLiabilities + bs.totalEquity)}</Badge>
        {bs.balanced ? <Badge tone="success" className="px-3 py-1 text-sm">Balanced</Badge> : <Badge tone="danger" className="px-3 py-1 text-sm">Out of balance</Badge>}
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card title="Assets">
          <dl>
            {bs.assets.map((r) => (
              <Line key={r.id} label={`${r.code} · ${r.name}`} value={formatPaise(r.amount)} />
            ))}
            <Line label="Total assets" value={formatPaise(bs.totalAssets)} strong />
          </dl>
        </Card>
        <Card title="Liabilities & Equity">
          <dl>
            {bs.liabilities.map((r) => (
              <Line key={r.id} label={`${r.code} · ${r.name}`} value={formatPaise(r.amount)} />
            ))}
            <Line label="Total liabilities" value={formatPaise(bs.totalLiabilities)} strong />
            <div className="mt-3" />
            {bs.equity.map((r) => (
              <Line key={r.id} label={`${r.code} · ${r.name}`} value={formatPaise(r.amount)} />
            ))}
            <Line label="Profit to date" value={formatPaise(bs.profit)} tone={bs.profit >= 0 ? "pos" : "neg"} />
            <Line label="Total equity" value={formatPaise(bs.totalEquity)} strong />
            <Line label="Liabilities + equity" value={formatPaise(bs.totalLiabilities + bs.totalEquity)} strong />
          </dl>
        </Card>
      </div>
    </AdminPage>
  );
}
