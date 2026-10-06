import { AlarmClock, ClipboardPlus, Truck, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ColumnChart } from "@/components/data/column-chart";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { ReportPeriodFilter } from "@/components/filters/report-period-filter";
import { todayIst } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { parsePeriodSelection, resolvePeriod } from "@/lib/report-period";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import { getServiceDashboard, getSalesTargetData, reportYears } from "@/modules/service/dashboard";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { getTatLimits } from "@/modules/service/queries";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Service Dashboard" };

function fmtL(paise: number): string {
  const r = paise / 100;
  if (r >= 1_00_00_000) return `₹${(r / 1_00_00_000).toFixed(2)} Cr`;
  if (r >= 1_00_000) return `₹${(r / 1_00_000).toFixed(2)} L`;
  if (r >= 1_000) return `₹${(r / 1_000).toFixed(1)}K`;
  return `₹${r.toLocaleString("en-IN")}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const stageHref = (status: string) => `${SERVICE_PATHS.cases}?tab=${status}`;

export default async function ServiceDashboardPage({ searchParams }: PageProps<"/service/dashboard">) {
  const { user } = await requirePageAccess(SERVICE_PATHS.dashboard);
  const sp = await searchParams;
  const today = todayIst();
  const selection = parsePeriodSelection(sp);
  const period = resolvePeriod(selection);
  const branch = await getBranchScope(user);
  const scope = branchWhere(branch);

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const day = Number(today.slice(8, 10));

  const [d, years, salesTarget] = await Promise.all([
    getTatLimits().then((tat) => getServiceDashboard(period, scope, tat)),
    reportYears(scope, year),
    getSalesTargetData(scope, year, month),
  ]);

  const periodWord = period.isToday ? "today" : "in period";
  const delta = d.delta === 0 ? `No change ${period.compareLabel}` : `${Math.abs(d.delta)} ${period.compareLabel}`;
  const Pending = STAGE_ICONS.PENDING_APPROVAL;
  const Stock = STAGE_ICONS.AWAITING_STOCK;
  const Quality = STAGE_ICONS.QUALITY_CHECK;
  const Closed = STAGE_ICONS.CLOSED;

  const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
  const daysInMonth = new Date(year, month, 0).getDate();
  const expectedPct = Math.round((day / daysInMonth) * 100);
  const achievedPct = salesTarget.targetPaise > 0
    ? Math.min(100, (salesTarget.achievedPaise / salesTarget.targetPaise) * 100)
    : 0;
  const paceGap = Math.round(achievedPct - expectedPct);

  return (
    <>
      <PageHeader
        title="Service dashboard"
        subtitle={`${period.label} · ${branch.branch ? `${branch.branch.name} (${branch.branch.code})` : "All branches"} · every number opens its case list`}
        breadcrumbs={["Service", "Dashboard"]}
      />
      <div className="mb-6">
        <ReportPeriodFilter path={SERVICE_PATHS.dashboard} selection={selection} years={years} today={today} />
      </div>

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label={period.isToday ? "New cases today" : "New cases"}
            value={d.newCases}
            icon={<ClipboardPlus />}
            href={SERVICE_PATHS.cases}
            note={{ text: delta, tone: d.delta > 0 ? "success" : d.delta < 0 ? "danger" : "muted", trend: d.delta > 0 ? "up" : d.delta < 0 ? "down" : undefined }}
          />
          <StatCard
            label="Ready-for-delivery receivables"
            hint="now"
            value={formatPaise(d.ready.duePaise)}
            icon={<Truck />}
            iconTone="success"
            href={stageHref("READY_FOR_DELIVERY")}
            note={{ text: `${plural(d.ready.count, "device", "devices")} awaiting pickup` }}
          />
          <StatCard
            label={period.isToday ? "Diagnosed today" : "Diagnosed"}
            value={d.diagnosed}
            icon={<Wrench />}
            iconTone="indigo"
            href={stageHref("DIAGNOSIS")}
            note={
              d.inDiagnosis > 0
                ? { text: `${d.inDiagnosis} still in diagnosis`, tone: "warning" }
                : { text: "Nothing waiting for diagnosis", tone: "muted" }
            }
          />
          <StatCard
            label="Aging cases"
            hint="now"
            value={d.aging.count}
            icon={<AlarmClock />}
            iconTone="muted"
            alert={d.aging.count > 0}
            href={`${SERVICE_PATHS.cases}?sort=stageChangedAt&dir=asc`}
            note={
              d.aging.count > 0
                ? { text: `${formatPaise(d.aging.duePaise)} receivable at risk`, tone: "danger" }
                : { text: "Every case within its TAT", tone: "success" }
            }
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card title={`New cases — ${period.selection.view === "year" ? "by month" : "by day"}`}>
            <ColumnChart data={d.trend} title="New cases per period" unit={["case", "cases"]} />
            <p className="mt-3 text-xs text-text-muted">
              {period.label}: walk-in {d.intake.WALK_IN ?? 0} · pickup {d.intake.PICKUP ?? 0} · on-site {d.intake.ON_SITE ?? 0}
            </p>
          </Card>

          <Card title={`Sales target — ${monthName}`}>
            {salesTarget.targetPaise === 0 ? (
              <p className="text-sm text-text-muted">No monthly target set for this branch.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-text">{fmtL(salesTarget.achievedPaise)} achieved</span>
                  <span className="text-sm text-text-muted">target {fmtL(salesTarget.targetPaise)}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-surface-muted">
                  <div
                    className="h-2.5 rounded-full bg-primary transition-all"
                    style={{ width: `${achievedPct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted">
                  Expected pace by day {day}: {expectedPct}%
                  {" · "}
                  <span className={paceGap >= 0 ? "font-semibold text-green-600" : "font-semibold text-red-600"}>
                    {paceGap >= 0 ? `+${paceGap}%` : `${paceGap}%`} {paceGap >= 0 ? "ahead of pace" : "behind pace"}
                  </span>
                </p>
              </div>
            )}
          </Card>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Pending approval"
            hint="now"
            value={d.pending.count}
            icon={<Pending />}
            iconTone="violet"
            href={stageHref("PENDING_APPROVAL")}
            note={
              d.pending.overdue > 0
                ? { text: `${d.pending.overdue} past follow-up time`, tone: "danger" }
                : { text: "Quotes with customers", tone: "muted" }
            }
          />
          <StatCard
            label="Awaiting stock"
            hint="now"
            value={d.awaitingStock.count}
            icon={<Stock />}
            iconTone="warning"
            href={stageHref("AWAITING_STOCK")}
            note={
              d.awaitingStock.overTwoDays > 0
                ? { text: `${d.awaitingStock.overTwoDays} waiting > 2 days`, tone: "danger" }
                : { text: "None waiting over 2 days", tone: "muted" }
            }
          />
          <StatCard
            label="In quality check"
            hint="now"
            value={d.quality.count}
            icon={<Quality />}
            iconTone="indigo"
            href={stageHref("QUALITY_CHECK")}
            note={{ text: `${d.quality.sentBack} sent back ${periodWord}`, tone: d.quality.sentBack > 0 ? "warning" : "muted" }}
          />
          <StatCard
            label={period.isToday ? "Closed today" : "Closed"}
            value={d.closed.count}
            icon={<Closed />}
            iconTone="navy"
            href={stageHref("CLOSED")}
            note={{ text: `${formatPaise(d.closed.collectedPaise)} collected ${periodWord}`, tone: "success" }}
          />
        </div>
      </div>
    </>
  );
}
