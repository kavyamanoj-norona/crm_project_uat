import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";
import { StatCard } from "@/components/data/stat-card";
import { DataTable } from "@/components/data/data-table";
import { PageHeader } from "@/components/layout/page-header";
import { personName } from "@/components/data/who-when";
import { formatDate } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { IndianRupee, Receipt, UserCheck } from "lucide-react";
import { saveIncentiveRule, saveTelecallerTarget, toggleIncentiveRule } from "@/modules/telecaller/actions";
import { IncentiveRuleDialog, TargetDialog } from "@/modules/telecaller/components/config-dialogs";
import { TELECALLER_PATHS } from "@/modules/telecaller/paths";
import { currentMonth, getIncentiveReport, isMonth, listIncentiveRules, listTargets, listTelecallers } from "@/modules/telecaller/queries";
import { INCENTIVE_BASIS_LABELS } from "@/modules/telecaller/schemas";
import { todayIst } from "@/modules/finance/daybook-dates";
import { requirePageAccess } from "@/server/rbac/guard";
import { isTelecaller } from "@/server/rbac/roles";

export const metadata = { title: "Telecaller Incentives" };

const monthFmt = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (m: string) => monthFmt.format(new Date(`${m}-01T00:00:00Z`));

export default async function IncentivesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, permission } = await requirePageAccess(TELECALLER_PATHS.incentives);
  const sp = await searchParams;
  const month = isMonth(typeof sp.month === "string" ? sp.month : undefined) ? (sp.month as string) : currentMonth();
  const own = isTelecaller(user);
  // A telecaller sees only their own figures; Head Office / admin see everyone, plus the rules and targets.
  const manage = !own;

  const [report, rules, targets, telecallers] = await Promise.all([
    getIncentiveReport(month, own ? user.id : null),
    manage ? listIncentiveRules() : Promise.resolve([]),
    manage ? listTargets(month) : Promise.resolve([]),
    manage ? listTelecallers() : Promise.resolve([]),
  ]);
  const staff = telecallers.map((u) => ({ value: u.id, label: [u.firstName, u.lastName].filter(Boolean).join(" ") }));
  const ruleText = (r: (typeof rules)[number]) =>
    r.basis === "MARGIN_PERCENT"
      ? `${(r.percentBp ?? 0) / 100}% of margin${r.minMarginPaise ? ` (min ${formatPaise(r.minMarginPaise)})` : ""}`
      : `${formatPaise(r.amountPaise ?? 0)} each`;

  return (
    <>
      <PageHeader
        title={own ? "My incentives" : "Telecaller incentives"}
        subtitle={`${monthLabel(month)} · conversions and billings credited to the telecaller who owns the lead · ${report.activeRules} active ${report.activeRules === 1 ? "rule" : "rules"}`}
        breadcrumbs={["Telecaller", "Incentives"]}
        actions={
          <form method="get" className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="inc-month">
              Month
            </label>
            <input id="inc-month" type="month" name="month" defaultValue={month} max={currentMonth()} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm outline-none focus:border-primary" />
            <Button type="submit" variant="secondary" size="sm">
              Apply
            </Button>
          </form>
        }
      />

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Eligible conversions" value={report.total.conversions} icon={<UserCheck />} iconTone="indigo" />
          <StatCard label="Completed billings" value={report.total.billings} icon={<Receipt />} iconTone="success" />
          <StatCard label="Billing margin" value={formatPaise(report.total.marginPaise)} icon={<IndianRupee />} iconTone="navy" />
          <StatCard label="Incentive" value={formatPaise(report.total.incentivePaise)} icon={<IndianRupee />} iconTone="primary" />
        </div>

        <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
          <div className="border-b border-border px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold">Incentive report — {monthLabel(month)}</h2>
          </div>
          <DataTable
            bordered={false}
            rows={report.rows}
            rowKey={(r) => r.userId ?? "none"}
            empty="No conversions or billings this month."
            columns={[
              { header: "Telecaller", cell: (r) => <span className="font-medium">{r.name}</span> },
              { header: "Conversions", align: "right", cell: (r) => <span className="tabular-nums">{r.conversions}</span> },
              { header: "Completed billings", align: "right", cell: (r) => <span className="tabular-nums">{r.billings}</span> },
              { header: "Billing margin", align: "right", cell: (r) => <span className="tabular-nums">{formatPaise(r.marginPaise)}</span> },
              { header: "Incentive", align: "right", cell: (r) => <span className="font-semibold tabular-nums">{formatPaise(r.incentivePaise)}</span> },
            ]}
          />
          <p className="border-t border-border px-4 py-3 text-xs text-text-muted sm:px-5">
            A conversion counts in the month the lead became a customer; a billing in the month its case was invoiced. Margin-percent rules skip billings with no margin recorded.
          </p>
        </section>

        {manage && (
          <>
            <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
                <h2 className="text-sm font-semibold">Incentive rules</h2>
                {permission.canCreate && <IncentiveRuleDialog action={saveIncentiveRule} today={todayIst()} />}
              </div>
              <DataTable
                bordered={false}
                rows={rules}
                rowKey={(r) => r.id}
                empty="No incentive rules yet, so no incentive is earned."
                columns={[
                  { header: "Rule", cell: (r) => <span className="font-medium">{r.name}</span> },
                  { header: "Earned on", cell: (r) => INCENTIVE_BASIS_LABELS[r.basis] },
                  { header: "Payout", cell: (r) => ruleText(r) },
                  { header: "Applies from", cell: (r) => formatDate(r.effectiveFrom) },
                  { header: "Status", cell: (r) => <Badge tone={r.isActive ? "success" : "neutral"}>{r.isActive ? "Active" : "Off"}</Badge> },
                  ...(permission.canEdit
                    ? [
                        {
                          header: "Action",
                          cell: (r: (typeof rules)[number]) => (
                            <ActionButton
                              action={toggleIncentiveRule.bind(null, r.id)}
                              label={r.isActive ? "Switch off" : "Switch on"}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-text-muted hover:bg-surface-muted hover:text-text"
                            >
                              {r.isActive ? "Switch off" : "Switch on"}
                            </ActionButton>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </section>

            <section className="min-w-0 rounded-xl border border-border bg-surface shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-4 sm:px-5">
                <h2 className="text-sm font-semibold">Monthly targets — {monthLabel(month)}</h2>
                {permission.canEdit && <TargetDialog action={saveTelecallerTarget} telecallers={staff} month={month} />}
              </div>
              <DataTable
                bordered={false}
                rows={targets}
                rowKey={(t) => t.id}
                empty="No targets set for this month."
                columns={[
                  { header: "Telecaller", cell: (t) => <span className="font-medium">{personName(t.user)}</span> },
                  { header: "Conversions target", align: "right", cell: (t) => <span className="tabular-nums">{t.conversionsTarget}</span> },
                  { header: "Billings target", align: "right", cell: (t) => <span className="tabular-nums">{t.billingsTarget}</span> },
                ]}
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}
