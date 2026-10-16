import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addAccount } from "@/modules/finance/actions";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { accountTotals, naturalBalance } from "@/modules/finance/queries";
import { getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Chart of Accounts" };

const TYPE_TONE = { ASSET: "primary", LIABILITY: "warning", EQUITY: "navy", INCOME: "success", EXPENSE: "danger" } as const;

export default async function AccountsPage() {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.accounts);
  const scope = await getBranchScope(user);
  const rows = (await accountTotals(scope.branchId, undefined, true)).map((a) => ({ ...a, balance: naturalBalance(a) }));

  return (
    <AdminPage
      title="Chart of Accounts"
      group="Finance"
      subtitle="Every account the books post to, with its balance. System accounts are posted automatically; add more expense heads as needed."
      actions={
        permission.canCreate && (
          <ActionDialog trigger="Add account" triggerVariant="primary" title="Add account" action={addAccount} submitLabel="Add account">
            <Field label="Code" htmlFor="ac-code" required hint="4 digits, e.g. 5160">
              <Input id="ac-code" name="code" inputMode="numeric" placeholder="Enter account code" />
            </Field>
            <Field label="Name" htmlFor="ac-name" required>
              <Input id="ac-name" name="name" placeholder="Enter account name" />
            </Field>
            <Field label="Type" htmlFor="ac-type" required>
              <Select id="ac-type" name="type" placeholder="Select account type" options={["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].map((t) => ({ value: t, label: t[0] + t.slice(1).toLowerCase() }))} />
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
          rowKey={(a) => a.id}
          empty="No accounts."
          columns={[
            { header: "Code", cell: (a) => <span className="font-medium tabular-nums">{a.code}</span> },
            { header: "Account", cell: (a) => <Link className="font-medium text-primary hover:underline" href={`${FINANCE_PATHS.ledger}?account=${a.id}`}>{a.name}</Link> },
            { header: "Type", cell: (a) => <Badge tone={TYPE_TONE[a.type as keyof typeof TYPE_TONE]}>{a.type[0] + a.type.slice(1).toLowerCase()}</Badge> },
            { header: "Debit ₹", align: "right", cell: (a) => <span className="tabular-nums">{formatPaise(a.debit, { symbol: false })}</span> },
            { header: "Credit ₹", align: "right", cell: (a) => <span className="tabular-nums">{formatPaise(a.credit, { symbol: false })}</span> },
            { header: "Balance ₹", align: "right", cell: (a) => <span className="font-semibold tabular-nums">{formatPaise(a.balance, { symbol: false })}</span> },
            { header: "Kind", cell: (a) => (a.id && rows.find((r) => r.id === a.id) && a.subType ? <span className="text-xs text-text-muted">{a.subType.replaceAll("_", " ").toLowerCase()}</span> : "—") },
          ]}
        />
      </div>
    </AdminPage>
  );
}
