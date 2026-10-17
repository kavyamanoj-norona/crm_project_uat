import { Banknote, Wallet, ArrowDownCircle, BoxIcon, Landmark, IndianRupee } from "lucide-react";
import { StatCard } from "@/components/data/stat-card";
import { DataTable } from "@/components/data/data-table";
import { DateRangeChip } from "@/components/data/date-range-chip";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { requirePageAccess } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";
import { setBranchScope } from "@/server/branch-actions";
import { formatPaise } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { param } from "@/modules/admin/components/admin-page";
import { FINANCE_PATHS } from "@/modules/finance/paths";
import {
  COLLECTION_MODES,
  dayCount,
  earliestUnclosedDay,
  getCollections,
  getDaybook,
  getDaybookSummary,
  isDateString,
  listBankAccounts,
  listExpenseAccounts,
  todayIst,
  type CollectionMode,
} from "@/modules/finance/daybook";
import { closeDaybook, depositCashToBank, postDaybookExpense } from "@/modules/finance/daybook-actions";
import {
  ClosedDayCard,
  DayStatusBadge,
  DepositCard,
  ExpenseCard,
  OpenBranchButton,
  ReconcileCard,
} from "@/modules/finance/components/daybook-client";

export const metadata = { title: "Daybook — Cash Book" };

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const fmtDay = (d: string) => dayFmt.format(new Date(`${d}T00:00:00Z`));

const MODE_LABELS: Record<CollectionMode, string> = { CASH: "Cash", UPI: "UPI", CARD: "Card", BANK_TRANSFER: "Bank transfer", OTHER: "Other" };

const TYPE_TAG: Record<string, { label: string; tone: "success" | "danger" | "navy" | "warning" | "neutral" } | undefined> = {
  auto: { label: "auto", tone: "success" },
  deposit: { label: "bank deposit", tone: "navy" },
  variance: { label: "day-end difference", tone: "warning" },
  reversal: { label: "reversal", tone: "neutral" },
};

/** Collections in every payment mode: cash goes to the box, the rest settles to the bank. */
function CollectionsCard({ modes, totalPaise }: { modes: Record<CollectionMode, number>; totalPaise: number }) {
  return (
    <Card title="Collections — all modes">
      <dl className="space-y-2 text-sm">
        {COLLECTION_MODES.map((m) => (
          <div key={m} className="flex justify-between gap-3">
            <dt className="text-text-muted">{MODE_LABELS[m]}</dt>
            <dd className="tabular-nums">{formatPaise(modes[m])}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border pt-2 font-semibold">
          <dt>Total collected</dt>
          <dd className="tabular-nums">{formatPaise(totalPaise)}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-text-muted">Case payments and counter sales. Only cash reaches the cash box.</p>
    </Card>
  );
}

export default async function DaybookPage({ searchParams }: PageProps<"/finance/daybook">) {
  const { user, permission } = await requirePageAccess(FINANCE_PATHS.daybook);
  const scope = await getBranchScope(user);
  const sp = await searchParams;
  const today = todayIst();

  // A range of business days, never past today. `date` is the old single-day link.
  const valid = (v: string | undefined) => (v && isDateString(v) && v <= today ? v : undefined);
  const legacy = valid(param(sp, "date"));
  let fromDate = valid(param(sp, "from")) ?? legacy ?? today;
  let toDate = valid(param(sp, "to")) ?? legacy ?? (param(sp, "from") ? fromDate : today);
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];
  const singleDay = fromDate === toDate;
  const isToday = singleDay && fromDate === today;
  const periodLabel = singleDay ? (isToday ? "Today's" : `${fmtDay(fromDate)}'s`) : `${fmtDay(fromDate)} – ${fmtDay(toDate)}`;

  const query: Record<string, string> = {};
  if (fromDate !== today || toDate !== today) Object.assign(query, { from: fromDate, to: toDate });

  const header = (status?: "open" | "closed") => (
    <PageHeader
      title={`Daybook — cash book${scope.branch ? `, ${scope.branch.name}` : ", all branches"}`}
      subtitle="Tracks the physical cash box only · UPI & Card settle to bank and never touch this balance · day must be reconciled and closed before tomorrow's opening"
      breadcrumbs={["Finance", "Daybook"]}
      badges={status && <DayStatusBadge status={status} />}
      actions={<DateRangeChip from={fromDate} to={toDate} max={today} align="right" list={{ path: FINANCE_PATHS.daybook, query, prefix: "" }} />}
    />
  );

  // ─── All branches: one row per branch, totals on top ──────────────────────
  if (!scope.branchId) {
    const s = await getDaybookSummary(fromDate, toDate);
    const days = dayCount(fromDate, toDate);
    type Row = (typeof s.rows)[number] | { id: "total" };
    const rows: Row[] = [...s.rows, { id: "total" }];
    const money = (r: Row, pick: (x: (typeof s.rows)[number]) => number, total: number, cls = "") => (
      <span className={`tabular-nums ${"code" in r ? "" : "font-semibold"} ${cls}`}>{formatPaise("code" in r ? pick(r) : total)}</span>
    );

    return (
      <>
        {header()}

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total collection"
            value={formatPaise(s.collectedPaise)}
            icon={<IndianRupee />}
            iconTone="success"
            note={{ text: `Cash ${formatPaise(s.modes.CASH)} · UPI ${formatPaise(s.modes.UPI)} · Card ${formatPaise(s.modes.CARD)}`, tone: "muted" }}
          />
          <StatCard label="Cash in (all boxes)" value={formatPaise(s.cashInPaise)} icon={<Banknote />} iconTone="navy" note={{ text: `Opening ${formatPaise(s.openingPaise)}`, tone: "muted" }} />
          <StatCard
            label="Expenses / cash out"
            value={formatPaise(s.expensesPaise + s.depositsPaise)}
            icon={<ArrowDownCircle />}
            iconTone="danger"
            note={{ text: `${formatPaise(s.expensesPaise)} expenses · ${formatPaise(s.depositsPaise)} to bank`, tone: "muted" }}
          />
          <StatCard label="Cash in boxes" value={formatPaise(s.closingPaise)} icon={<BoxIcon />} iconTone="primary" note={{ text: "Across all branches", tone: "muted" }} />
        </div>

        <div className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-text">{periodLabel} cash book by branch</h2>
            <p className="text-xs text-text-muted">Open a branch to see its entries, post expenses or close its day</p>
          </div>
          <DataTable
            bordered={false}
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                header: "Branch",
                cell: (r) =>
                  "code" in r ? (
                    <span className="flex flex-col leading-tight">
                      <span className="font-medium">{r.name}</span>
                      <span className="text-xs text-text-muted">{r.code}</span>
                    </span>
                  ) : (
                    <span className="font-semibold">Total</span>
                  ),
              },
              { header: "Opening", align: "right", cell: (r) => money(r, (x) => x.openingPaise, s.openingPaise) },
              { header: "Cash in", align: "right", cell: (r) => money(r, (x) => x.cashInPaise, s.cashInPaise, "text-success") },
              { header: "Expenses", align: "right", cell: (r) => money(r, (x) => x.expensesPaise, s.expensesPaise, "text-danger") },
              { header: "To bank", align: "right", cell: (r) => money(r, (x) => x.depositsPaise, s.depositsPaise) },
              { header: "Cash in box", align: "right", cell: (r) => money(r, (x) => x.closingPaise, s.closingPaise) },
              { header: "UPI", align: "right", cell: (r) => money(r, (x) => x.modes.UPI, s.modes.UPI) },
              { header: "Card", align: "right", cell: (r) => money(r, (x) => x.modes.CARD, s.modes.CARD) },
              { header: "Bank / other", align: "right", cell: (r) => money(r, (x) => x.modes.BANK_TRANSFER + x.modes.OTHER, s.modes.BANK_TRANSFER + s.modes.OTHER) },
              { header: "Total collected", align: "right", cell: (r) => money(r, (x) => x.collectedPaise, s.collectedPaise, "font-semibold") },
              {
                header: singleDay ? "Day" : "Days closed",
                align: "center",
                cell: (r) => {
                  if (!("code" in r)) return null;
                  if (singleDay) return <Badge tone={r.closedDays ? "success" : "danger"}>{r.closedDays ? "Closed" : "Open"}</Badge>;
                  return (
                    <Badge tone={r.closedDays === days ? "success" : "danger"}>
                      {r.closedDays} / {days}
                    </Badge>
                  );
                },
              },
              {
                header: "Difference",
                align: "right",
                cell: (r) => {
                  const v = "code" in r ? r.variancePaise : s.variancePaise;
                  return v ? <span className="tabular-nums text-danger">{`${v < 0 ? "Short" : "Over"} ${formatPaise(Math.abs(v))}`}</span> : <span className="text-text-muted">—</span>;
                },
              },
              { header: "Action", align: "center", cell: (r) => ("code" in r ? <OpenBranchButton action={setBranchScope.bind(null, r.id)} label={r.name} /> : null) },
            ]}
          />
          <p className="border-t border-border px-4 py-3 text-xs text-text-muted sm:px-5">
            Cash columns are the branch cash box (ledger). UPI, Card and Bank are collections that settle straight to the bank.
          </p>
        </div>
      </>
    );
  }

  // ─── One branch ───────────────────────────────────────────────────────────
  const branchId = scope.branchId;
  const [book, collections, categories, banks, unclosedBefore] = await Promise.all([
    getDaybook(branchId, fromDate, toDate),
    getCollections(branchId, fromDate, toDate),
    listExpenseAccounts(),
    listBankAccounts(),
    singleDay ? earliestUnclosedDay(branchId, fromDate) : Promise.resolve(null),
  ]);
  const closed = Boolean(book.close);
  // New cash entries go on today only, and only while today is open. Closing works one day at a time.
  const canPost = permission.canCreate && isToday && !closed;
  const canClose = permission.canEdit && singleDay && !closed;
  const days = dayCount(fromDate, toDate);

  type Row = (typeof book.rows)[number] | { id: "opening"; opening: true };
  const rows: Row[] = [{ id: "opening", opening: true }, ...book.rows];

  return (
    <>
      {header(singleDay ? (closed ? "closed" : "open") : undefined)}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Opening balance"
          value={formatPaise(book.openingPaise)}
          icon={<Wallet />}
          iconTone="navy"
          note={{ text: singleDay ? "Carried from the previous day" : `Brought forward on ${fmtDay(fromDate)}`, tone: "muted" }}
        />
        <StatCard
          label="Cash in (auto from CRM)"
          value={formatPaise(book.cashInPaise)}
          icon={<Banknote />}
          iconTone="success"
          note={{ text: `Total collection, all modes: ${formatPaise(collections.totalPaise)}`, tone: "muted" }}
        />
        <StatCard
          label="Expenses / cash out"
          value={formatPaise(book.expensesPaise + book.depositsPaise)}
          icon={book.depositsPaise ? <Landmark /> : <ArrowDownCircle />}
          iconTone="danger"
          note={{ text: `${book.expenseCount} ${book.expenseCount === 1 ? "expense" : "expenses"}${book.depositsPaise ? ` · ${formatPaise(book.depositsPaise)} to bank` : ""}`, tone: "muted" }}
        />
        <StatCard
          label={singleDay ? "Cash in box (CRM)" : "Closing balance (CRM)"}
          hint={isToday && !closed ? "live" : undefined}
          value={formatPaise(book.balancePaise)}
          icon={<BoxIcon />}
          iconTone="primary"
          note={{ text: "Opening + in − out", tone: "muted" }}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-text">{periodLabel} cash transactions</h2>
            <p className="text-xs text-text-muted">auto-posted from case payments &amp; sales; expenses and deposits posted from the forms</p>
          </div>
          <DataTable
            bordered={false}
            rows={rows}
            rowKey={(r) => r.id}
            columns={[
              {
                header: singleDay ? "Time" : "Date",
                cell: (r) => ("opening" in r ? "—" : <span className="text-xs whitespace-nowrap text-text-muted">{(singleDay ? timeFmt : dateTimeFmt).format(r.at)}</span>),
              },
              {
                header: "Description",
                cell: (r) =>
                  "opening" in r ? (
                    <span className="font-semibold">Opening balance b/f</span>
                  ) : (
                    <div className="max-w-xl whitespace-normal">
                      <span>{r.description}</span>
                      {TYPE_TAG[r.type] && (
                        <Badge tone={TYPE_TAG[r.type]!.tone} className="ml-2">
                          {TYPE_TAG[r.type]!.label}
                        </Badge>
                      )}
                      {r.receiptUrl && (
                        <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="ml-1.5 text-[11px] font-medium text-primary hover:underline">
                          receipt
                        </a>
                      )}
                      {r.remarks && <p className="text-xs text-text-muted">{r.remarks}</p>}
                      <p className="text-[11px] text-text-muted">
                        {r.entryNo}
                        {r.by && ` · ${personName(r.by)}`}
                      </p>
                    </div>
                  ),
              },
              { header: "Money in", align: "right", cell: (r) => ("opening" in r || !r.inPaise ? "" : <span className="font-medium tabular-nums text-success">{formatPaise(r.inPaise)}</span>) },
              { header: "Money out", align: "right", cell: (r) => ("opening" in r || !r.outPaise ? "" : <span className="font-medium tabular-nums text-danger">{formatPaise(r.outPaise)}</span>) },
              {
                header: "Balance",
                align: "right",
                cell: (r) => <span className="font-semibold tabular-nums">{formatPaise("opening" in r ? book.openingPaise : r.balancePaise)}</span>,
              },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 sm:px-5">
            <p className="text-xs text-text-muted">Cash entries can&apos;t be edited or deleted after saving. Corrections go through a reversal by Finance.</p>
            <p className="shrink-0 text-xs font-semibold text-text">CRM cash balance: {formatPaise(book.balancePaise)}</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          {closed && book.close ? (
            <ClosedDayCard
              crmPaise={book.close.crmBalancePaise}
              physicalPaise={book.close.physicalPaise}
              variancePaise={book.close.variancePaise}
              remarks={book.close.remarks}
              closedBy={personName(book.close.closedBy)}
              closedAt={formatDateTime(book.close.closedAt)}
              varianceEntryNo={book.close.varianceEntry?.entryNo ?? null}
            />
          ) : (
            <>
              {canPost && (
                <>
                  <ExpenseCard action={postDaybookExpense} categories={categories.map((a) => ({ value: a.id, label: a.name }))} />
                  <DepositCard action={depositCashToBank} banks={banks.map((a) => ({ value: a.id, label: `${a.name} (${a.code})` }))} />
                </>
              )}
              {!isToday && (
                <p className="rounded-lg bg-surface-muted px-3 py-2 text-xs text-text-muted">
                  {singleDay
                    ? "Expenses and deposits are posted on today's cash book only."
                    : `${book.closedDays} of ${days} days closed. Pick a single day to close it; expenses and deposits are posted on today's cash book only.`}
                </p>
              )}
              {canClose && <ReconcileCard key={fromDate} action={closeDaybook} date={fromDate} crmBalancePaise={book.balancePaise} unclosedBefore={unclosedBefore} />}
            </>
          )}
          <CollectionsCard modes={collections.byBranch(branchId)} totalPaise={collections.totalPaise} />
        </div>
      </div>
    </>
  );
}
