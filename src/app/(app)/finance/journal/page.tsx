import { Badge } from "@/components/ui/badge";
import { ListView } from "@/components/data/list-view";
import { ActionDialog } from "@/components/forms/action-dialog";
import { Field, Textarea } from "@/components/ui/field";
import { KvList } from "@/components/ui/kv-list";
import { formatDate, formatDateTime, todayIst } from "@/lib/dates";
import { listState } from "@/lib/list";
import { formatPaise } from "@/lib/money";
import { AdminPage } from "@/modules/admin/components/admin-page";
import { addManualJournal, reverseEntry } from "@/modules/finance/actions";
import { ManualJournalDialog } from "@/modules/finance/components/manual-journal-dialog";
import { listJournalPage } from "@/modules/finance/lists";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import { ViewButton } from "@/modules/inventory/components/purchasing-details";
import { db } from "@/server/db";
import { getBranchScope, listBranchOptions } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Journal Entries" };

const SOURCE_LABEL: Record<string, string> = {
  CASE_INVOICE: "Invoice",
  CASE_PAYMENT: "Receipt",
  PURCHASE_BILL: "Purchase",
  PURCHASE_PAYMENT: "Supplier payment",
  DIRECT_SALE: "Sale",
  EXPENSE: "Expense",
  TRANSFER: "Transfer",
  CREDIT_NOTE: "Credit note",
  COGS: "Cost of goods",
  MANUAL: "Manual",
  REVERSAL: "Reversal",
  CASH_DEPOSIT: "Cash deposit",
  CASH_VARIANCE: "Day-end difference",
  OFFICE_CONSUMPTION: "Office use",
};

export default async function JournalPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.journal);
  const sp = await searchParams;
  const list = listState(FINANCE_PATHS.journal, sp, { sorts: ["entryDate"] as const, defaultSort: "entryDate" });
  const scope = await getBranchScope(user);
  const [{ rows, total, tabs, reversed }, accounts, branches] = await Promise.all([
    listJournalPage(list, scope.branchId),
    permission.canCreate ? db.account.findMany({ where: { isActive: true }, orderBy: { code: "asc" }, select: { id: true, code: true, name: true } }) : Promise.resolve([]),
    permission.canCreate ? listBranchOptions() : Promise.resolve([]),
  ]);

  return (
    <AdminPage
      title="Journal Entries"
      group="Finance"
      subtitle="Every financial event as balanced debit and credit lines. Entries are never edited: a mistake is corrected by a reversal."
      actions={permission.canCreate && <ManualJournalDialog accounts={accounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} branches={branches.map((b) => ({ value: b.id, label: b.code }))} today={todayIst()} action={addManualJournal} />}
    >
      <ListView
        list={list}
        total={total}
        tabs={tabs}
        tone="blue"
        rows={rows}
        rowKey={(e) => e.id}
        searchPlaceholder="Search by entry number or narration"
        empty="No journal entries yet."
        columns={[
          { header: "#", cell: (_, i) => i + 1 },
          { header: "Entry", cell: (e) => <span className="text-xs font-medium tabular-nums">{e.entryNo}</span> },
          { header: "Date", cell: (e) => formatDate(e.entryDate) },
          { header: "Narration", cell: (e) => <p className="max-w-80 truncate text-sm" title={e.narration}>{e.narration}</p> },
          { header: "Source", cell: (e) => <Badge tone={e.sourceType === "REVERSAL" ? "danger" : "navy"}>{SOURCE_LABEL[e.sourceType] ?? e.sourceType}</Badge> },
          { header: "Branch", cell: (e) => <span className="text-xs text-text-muted">{[...new Set(e.lines.map((l) => l.branch.code))].join(", ")}</span> },
          { header: "Amount ₹", align: "right", cell: (e) => <span className="font-semibold tabular-nums">{formatPaise(e.lines.reduce((s, l) => s + l.debitPaise, 0), { symbol: false })}</span> },
          { header: "Status", cell: (e) => (reversed.has(e.id) ? <Badge tone="danger">Reversed</Badge> : <Badge tone="success">Posted</Badge>) },
          {
            header: "Actions",
            align: "center",
            cell: (e) => (
              <div className="flex items-center justify-center gap-1.5">
                <ViewButton title={e.entryNo} subtitle={e.narration}>
                  <div className="space-y-4">
                    <KvList items={[["Date", formatDateTime(e.entryDate)], ["Source", SOURCE_LABEL[e.sourceType] ?? e.sourceType], ["Source ID", e.sourceId ?? "—"]]} />
                    <table className="w-full text-sm">
                      <thead className="bg-surface-muted text-xs font-semibold">
                        <tr>
                          <th className="px-3 py-2 text-left">Account</th>
                          <th className="px-3 py-2 text-center">Branch</th>
                          <th className="px-3 py-2 text-right">Debit ₹</th>
                          <th className="px-3 py-2 text-right">Credit ₹</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {e.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2">{l.account.code} — {l.account.name}{l.memo && <span className="block text-xs text-text-muted">{l.memo}</span>}</td>
                            <td className="px-3 py-2 text-center">{l.branch.code}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.debitPaise ? formatPaise(l.debitPaise, { symbol: false }) : ""}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{l.creditPaise ? formatPaise(l.creditPaise, { symbol: false }) : ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ViewButton>
                {permission.canEdit && e.sourceType !== "REVERSAL" && !reversed.has(e.id) && (
                  <ActionDialog trigger="Reverse" triggerVariant="secondary" triggerSize="sm" title={`Reverse ${e.entryNo}?`} description="A mirror entry is posted. The original stays in the books." action={reverseEntry.bind(null, e.id)} submitLabel="Post reversal">
                    <Field label="Reason" htmlFor={`rev-${e.id}`} required>
                      <Textarea id={`rev-${e.id}`} name="reason" rows={2} placeholder="Enter reason" />
                    </Field>
                  </ActionDialog>
                )}
              </div>
            ),
          },
        ]}
      />
    </AdminPage>
  );
}
