import Link from "next/link";
import { Landmark, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ActionButton } from "@/components/ui/action-button";
import { buttonClass } from "@/components/ui/button";
import { DataTable } from "@/components/data/data-table";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addBankAccount, addPaymentRoute, moveBankMoney, removePaymentRoute, toggleBankAccount } from "@/modules/finance/bank-actions";
import { countBankAtBranches, listBankBooks, listPaymentRoutes, MODE_LABEL, ROUTABLE_MODES } from "@/modules/finance/bank";
import { todayIst } from "@/modules/finance/daybook";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { cashAndBank } from "@/modules/finance/queries";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { db } from "@/server/db";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Cash & Bank" };

const mask = (n: string | null | undefined) => (n ? `••••${n.slice(-4)}` : "—");

export default async function CashBankPage() {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.cashBank);
  const scope = await getBranchScope(user);
  const [rows, banks, routes, branches, atBranches, cashAccount] = await Promise.all([
    cashAndBank(scope.branchId),
    listBankBooks(),
    listPaymentRoutes(),
    listBranchOptions(),
    countBankAtBranches(),
    db.account.findUnique({ where: { code: "1000" }, select: { id: true } }),
  ]);
  const cash = rows.reduce((s, r) => s + r.cash, 0);
  const bank = rows.reduce((s, r) => s + r.bank, 0);
  const activeBanks = banks.filter((b) => b.isActive && b.detail);

  return (
    <AdminPage
      title="Cash & Bank"
      group="Finance"
      subtitle="Cash in hand by branch, and the Head Office bank accounts that UPI, card and bank-transfer payments settle into"
      actions={
        <>
          {permission.canEdit && atBranches > 0 && (
            <ActionButton action={moveBankMoney} label="Move bank money to Head Office" className={buttonClass("secondary")}>
              Move {atBranches} bank {atBranches === 1 ? "posting" : "postings"} to Head Office
            </ActionButton>
          )}
          {permission.canCreate && (
            <ActionDialog trigger="Add bank account" triggerVariant="primary" title="Add bank account" action={addBankAccount} submitLabel="Add bank account">
              <Field label="Bank name" htmlFor="ba-bank" required>
                <Input id="ba-bank" name="bankName" placeholder="Enter bank name" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account number" htmlFor="ba-number" required>
                  <Input id="ba-number" name="accountNumber" inputMode="numeric" placeholder="Enter account number" />
                </Field>
                <Field label="IFSC code" htmlFor="ba-ifsc">
                  <Input id="ba-ifsc" name="ifsc" placeholder="Enter IFSC code" className="uppercase" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account holder" htmlFor="ba-holder">
                  <Input id="ba-holder" name="accountHolder" placeholder="Enter account holder" />
                </Field>
                <Field label="Bank branch" htmlFor="ba-branch">
                  <Input id="ba-branch" name="bankBranch" placeholder="Enter bank branch" />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Opening balance ₹" htmlFor="ba-opening" hint="Leave blank for zero. Posted at Head Office on the opening date.">
                  <Input id="ba-opening" name="opening" inputMode="decimal" placeholder="Enter opening balance" />
                </Field>
                <Field label="Opening date" htmlFor="ba-date">
                  <Input id="ba-date" type="date" name="openingDate" defaultValue={todayIst()} max={todayIst()} />
                </Field>
              </div>
            </ActionDialog>
          )}
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-3">
        <Badge tone="success" className="px-3 py-1 text-sm tabular-nums">Cash {formatPaise(cash)}</Badge>
        <Badge tone="primary" className="px-3 py-1 text-sm tabular-nums">Bank {formatPaise(bank)}</Badge>
        <Badge tone="navy" className="px-3 py-1 text-sm tabular-nums">Total {formatPaise(cash + bank)}</Badge>
        {atBranches > 0 && <Badge tone="warning" className="px-3 py-1 text-sm">{atBranches} bank {atBranches === 1 ? "posting is" : "postings are"} still on a branch</Badge>}
      </div>

      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-text">
        <Landmark className="size-4 text-text-muted" /> Head Office bank accounts
      </h2>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={banks}
          rowKey={(b) => b.id}
          empty="No bank accounts."
          columns={[
            {
              header: "Bank account",
              cell: (b) => (
                <span className="flex flex-col leading-tight">
                  <Link className="font-medium text-primary hover:underline" href={`${FINANCE_PATHS.ledger}?account=${b.id}`}>
                    {b.detail?.bankName ?? b.name}
                  </Link>
                  <span className="text-xs text-text-muted">
                    {b.code}
                    {b.detail?.accountHolder && ` · ${b.detail.accountHolder}`}
                  </span>
                </span>
              ),
            },
            { header: "Account no.", cell: (b) => <span className="tabular-nums">{mask(b.detail?.accountNumber)}</span> },
            { header: "IFSC", cell: (b) => b.detail?.ifsc ?? "—" },
            { header: "Opening ₹", align: "right", cell: (b) => <span className="tabular-nums">{b.detail ? formatPaise(b.detail.openingPaise, { symbol: false }) : "—"}</span> },
            { header: "Balance ₹", align: "right", cell: (b) => <span className="font-semibold tabular-nums">{formatPaise(b.balancePaise, { symbol: false })}</span> },
            { header: "Routes", align: "center", cell: (b) => (b.detail ? b.routeCount : "—") },
            { header: "Status", align: "center", cell: (b) => <Badge tone={b.isActive ? "success" : "neutral"}>{b.isActive ? "Active" : "Off"}</Badge> },
            {
              header: "Action",
              align: "center",
              cell: (b) =>
                permission.canEdit && b.code !== "1010" ? (
                  <ActionButton
                    action={toggleBankAccount.bind(null, b.id)}
                    label={b.isActive ? "Switch off" : "Switch on"}
                    confirm={b.isActive ? `Switch off ${b.detail?.bankName ?? b.name}?` : undefined}
                    confirmLabel="Switch off"
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    {b.isActive ? "Switch off" : "Switch on"}
                  </ActionButton>
                ) : (
                  <span className="text-text-muted">—</span>
                ),
            },
          ]}
        />
      </div>

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
          <Route className="size-4 text-text-muted" /> Payment routing
        </h2>
        {permission.canCreate && (
          <ActionDialog trigger="Add route" triggerVariant="secondary" triggerSize="sm" title="Add payment route" action={addPaymentRoute} submitLabel="Add route">
            <Field label="Payment mode" htmlFor="pr-mode" required>
              <Select id="pr-mode" name="mode" placeholder="Select payment mode" options={ROUTABLE_MODES.map((m) => ({ value: m, label: MODE_LABEL[m]! }))} />
            </Field>
            <Field label="Branch" htmlFor="pr-branch" hint="Leave on all branches to use it everywhere. A branch route wins over it.">
              <Select id="pr-branch" name="branchId" placeholder="All branches" options={branches.map((b) => ({ value: b.id, label: `${b.code} — ${b.name}` }))} />
            </Field>
            <Field label="UPI ID" htmlFor="pr-upi" hint="Optional, UPI only. Notes which UPI ID or QR this route is for.">
              <Input id="pr-upi" name="upiId" placeholder="Enter UPI ID" />
            </Field>
            <Field label="Bank account" htmlFor="pr-bank" required>
              <Select
                id="pr-bank"
                name="bankAccountId"
                placeholder={activeBanks.length ? "Select bank account" : "Add a bank account first"}
                options={activeBanks.map((b) => ({ value: b.detail!.id, label: `${b.detail!.bankName} ${mask(b.detail!.accountNumber)} (${b.code})` }))}
              />
            </Field>
          </ActionDialog>
        )}
      </div>
      <div className="mb-6 overflow-hidden rounded-xl border border-border bg-surface">
        <DataTable
          tone="blue"
          bordered={false}
          rows={routes}
          rowKey={(r) => r.id}
          empty="No routes yet. Every UPI, card and bank-transfer payment goes to the default bank account (1010)."
          columns={[
            { header: "Mode", cell: (r) => <Badge tone="primary">{MODE_LABEL[r.mode] ?? r.mode}</Badge> },
            { header: "Branch", cell: (r) => (r.branch ? `${r.branch.code} — ${r.branch.name}` : "All branches") },
            { header: "UPI ID", cell: (r) => r.upiId ?? "—" },
            { header: "Settles into", cell: (r) => `${r.bankAccount.bankName} (${r.bankAccount.account.code})` },
            {
              header: "Action",
              align: "center",
              cell: (r) =>
                permission.canEdit ? (
                  <ActionButton action={removePaymentRoute.bind(null, r.id)} label="Remove route" confirm="Remove this route? Payments already posted stay where they are." confirmLabel="Remove" className="text-xs font-semibold text-danger hover:underline">
                    Remove
                  </ActionButton>
                ) : null,
            },
          ]}
        />
        <p className="border-t border-border px-4 py-3 text-xs text-text-muted">
          A payment with no route settles into the default bank account (1010). Changing a route only affects new payments.
        </p>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-text">Cash by branch</h2>
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
                  <Link className="font-medium text-primary hover:underline" href={`${FINANCE_PATHS.ledger}?account=${cashAccount?.id ?? ""}&branch=${r.id}`}>Cash book</Link>
                </span>
              ),
            },
          ]}
        />
      </div>
    </AdminPage>
  );
}
