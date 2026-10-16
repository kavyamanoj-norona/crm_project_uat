import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { cashAndBank } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { db } from "@/server/db";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Cash & Bank" };

export default async function CashBankPage() {
  const { user } = await requirePageAccess(FINANCE_PATHS.cashBank);
  const scope = await getBranchScope(user);
  const [rows, accounts] = await Promise.all([cashAndBank(scope.branchId), db.account.findMany({ where: { code: { in: ["1000", "1010"] } }, select: { id: true, code: true } })]);
  const cashId = accounts.find((a) => a.code === "1000")?.id ?? "";
  const bankId = accounts.find((a) => a.code === "1010")?.id ?? "";
  const cash = rows.reduce((s, r) => s + r.cash, 0);
  const bank = rows.reduce((s, r) => s + r.bank, 0);

  return (
    <AdminPage title="Cash & Bank" group="Finance" subtitle="Cash in hand and bank / digital payment balances, branch by branch, with the Head Office total">
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="success" className="px-3 py-1 text-sm tabular-nums">Cash {formatPaise(cash)}</Badge>
        <Badge tone="primary" className="px-3 py-1 text-sm tabular-nums">Bank {formatPaise(bank)}</Badge>
        <Badge tone="navy" className="px-3 py-1 text-sm tabular-nums">Total {formatPaise(cash + bank)}</Badge>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={rows}
          rowKey={(r) => r.id}
          empty="No branches."
          columns={[
            { header: "#", cell: (_, i) => i + 1 },
            { header: "Branch", cell: (r) => <span className="font-medium">{r.code} — {r.name}</span> },
            { header: "Cash in hand ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.cash, { symbol: false })}</span> },
            { header: "Bank & digital ₹", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.bank, { symbol: false })}</span> },
            { header: "Total ₹", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.cash + r.bank, { symbol: false })}</span> },
            {
              header: "Book",
              align: "center",
              cell: (r) => (
                <span className="flex items-center justify-center gap-3 text-sm">
                  <Link className="font-medium text-primary hover:underline" href={`${FINANCE_PATHS.ledger}?account=${cashId}&branch=${r.id}`}>Cash book</Link>
                  <Link className="font-medium text-primary hover:underline" href={`${FINANCE_PATHS.ledger}?account=${bankId}&branch=${r.id}`}>Bank book</Link>
                </span>
              ),
            },
          ]}
        />
      </div>
    </AdminPage>
  );
}
