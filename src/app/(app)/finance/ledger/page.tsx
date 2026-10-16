import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { Input, Select } from "@/components/ui/field";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { accountLedger, parseRange } from "@/modules/finance/queries";
import { db } from "@/server/db";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Ledger" };

export default async function LedgerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requirePageAccess(FINANCE_PATHS.ledger);
  const sp = await searchParams;
  const range = parseRange(sp);
  const scope = await getBranchScope(user);
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  // A branch-bound user always sees their own branch; Head Office can pick one or see all.
  const branchId = scope.branchId ?? (str("branch") || null);
  const [accounts, branches] = await Promise.all([db.account.findMany({ orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }), scope.branchId ? Promise.resolve([]) : listBranchOptions()]);
  const accountId = str("account") || accounts[0]?.id || "";
  const ledger = accountId ? await accountLedger(accountId, branchId, range) : null;

  return (
    <AdminPage title="Ledger" group="Finance" subtitle="All postings to one account, with the running balance. Choose a branch, or leave it blank for the Head Office consolidated view.">
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-3">
        <label className="min-w-56 flex-1 text-xs font-bold text-brand-navy dark:text-text">
          Account
          <Select name="account" defaultValue={accountId} options={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} placeholder="Select account" className="mt-1" />
        </label>
        {!scope.branchId && (
          <label className="w-44 text-xs font-bold text-brand-navy dark:text-text">
            Branch
            <Select name="branch" defaultValue={branchId ?? ""} options={branches.map((b) => ({ value: b.id, label: b.code }))} placeholder="All branches" className="mt-1" />
          </label>
        )}
        <label className="text-xs font-bold text-brand-navy dark:text-text">
          From
          <Input type="date" name="from" defaultValue={range.fromStr} className="mt-1 w-40" />
        </label>
        <label className="text-xs font-bold text-brand-navy dark:text-text">
          To
          <Input type="date" name="to" defaultValue={range.toStr} className="mt-1 w-40" />
        </label>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </form>

      {ledger && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            <Badge tone="navy" className="px-3 py-1 text-sm">{ledger.account.code} — {ledger.account.name}</Badge>
            <Badge tone="neutral" className="px-3 py-1 text-sm tabular-nums">Opening {formatPaise(ledger.openingBalance)}</Badge>
            <Badge tone="primary" className="px-3 py-1 text-sm tabular-nums">Closing {formatPaise(ledger.closingBalance)}</Badge>
            {ledger.truncated && <Badge tone="warning">Showing the first 1000 lines: narrow the dates</Badge>}
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <DataTable
              tone="blue"
              bordered={false}
              rows={ledger.rows}
              rowKey={(l) => l.id}
              empty="No postings to this account in the period."
              columns={[
                { header: "Date", cell: (l) => formatDate(l.entry.entryDate) },
                { header: "Entry", cell: (l) => <span className="text-xs tabular-nums">{l.entry.entryNo}</span> },
                { header: "Narration", cell: (l) => <p className="max-w-80 truncate text-sm" title={l.entry.narration}>{l.entry.narration}</p> },
                { header: "Branch", cell: (l) => <span className="text-xs text-text-muted">{l.branch.code}</span> },
                { header: "Debit ₹", align: "right", cell: (l) => <span className="tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise, { symbol: false }) : ""}</span> },
                { header: "Credit ₹", align: "right", cell: (l) => <span className="tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise, { symbol: false }) : ""}</span> },
                { header: "Balance ₹", align: "right", cell: (l) => <span className="font-semibold tabular-nums">{formatPaise(l.balance, { symbol: false })}</span> },
              ]}
            />
          </div>
        </>
      )}
    </AdminPage>
  );
}
