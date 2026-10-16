import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { DateFilter } from "@/modules/finance/components/finance-ui";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { accountTotals, parseRange } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Trial Balance" };

export default async function TrialBalancePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.trialBalance);
  const sp = await searchParams;
  const range = parseRange(sp, "2000-01-01");
  const scope = await getBranchScope(user);
  const rows = await accountTotals(scope.branchId, { to: range.to });
  const debit = rows.reduce((s, r) => s + r.debit, 0);
  const credit = rows.reduce((s, r) => s + r.credit, 0);

  return (
    <AdminPage title="Trial Balance" group="Finance" subtitle="Total debits and credits of every account up to a date. They must be equal: the check that the books balance.">
      <DateFilter from="" to={range.toStr} single />
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="navy" className="px-3 py-1 text-sm tabular-nums">Debit {formatPaise(debit)}</Badge>
        <Badge tone="navy" className="px-3 py-1 text-sm tabular-nums">Credit {formatPaise(credit)}</Badge>
        {debit === credit ? <Badge tone="success" className="px-3 py-1 text-sm">Balanced</Badge> : <Badge tone="danger" className="px-3 py-1 text-sm">Out of balance by {formatPaise(Math.abs(debit - credit))}</Badge>}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No postings yet."
          columns={[
            { header: "Code", cell: (r) => <span className="font-medium tabular-nums">{r.code}</span> },
            { header: "Account", cell: (r) => r.name },
            { header: "Type", cell: (r) => <span className="text-xs text-text-muted">{r.type[0] + r.type.slice(1).toLowerCase()}</span> },
            { header: "Debit ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.debit, { symbol: false })}</span> },
            { header: "Credit ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.credit, { symbol: false })}</span> },
            { header: "Net ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.debit - r.credit, { symbol: false })} {r.debit >= r.credit ? "Dr" : "Cr"}</span> },
          ]}
        />
      </div>
    </AdminPage>
  );
}
