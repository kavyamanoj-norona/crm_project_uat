import Link from "next/link";
import { AlarmClock, ClipboardPlus, Truck, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ColumnChart } from "@/components/data/column-chart";
import { StatCard } from "@/components/data/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { ReportPeriodFilter } from "@/components/filters/report-period-filter";
import { todayIst } from "@/lib/dates";
import { formatPaise } from "@/lib/money";
import { parsePeriodSelection, resolvePeriod } from "@/lib/report-period";
import { CASE_STATUS_LABELS } from "@/modules/service/case-schema";
import { STAGE_ICONS } from "@/modules/service/components/stage-icons";
import { getServiceDashboard, reportYears } from "@/modules/service/dashboard";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { getTatLimits } from "@/modules/service/queries";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { requirePageAccess } from "@/server/rbac/guard";

export const metadata = { title: "Service Dashboard" };

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

  const [d, years] = await Promise.all([
    getTatLimits().then((tat) => getServiceDashboard(period, scope, tat)),
    reportYears(scope, Number(today.slice(0, 4))),
  ]);

  const periodWord = period.isToday ? "today" : "in period";
  const delta = d.delta === 0 ? `No change ${period.compareLabel}` : `${Math.abs(d.delta)} ${period.compareLabel}`;
  const Pending = STAGE_ICONS.PENDING_APPROVAL;
  const Stock = STAGE_ICONS.AWAITING_STOCK;
  const Quality = STAGE_ICONS.QUALITY_CHECK;
  const Closed = STAGE_ICONS.CLOSED;
  const maxStage = Math.max(1, ...d.pipeline.map((p) => p.count));

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

          <Card
            title="Open cases by stage"
            actions={<span className="text-xs font-medium text-text-muted">{plural(d.openTotal, "open case", "open cases")} · now</span>}
          >
            <ul className="space-y-3">
              {d.pipeline.map((p) => {
                const Icon = STAGE_ICONS[p.status];
                return (
                  <li key={p.status}>
                    <Link href={stageHref(p.status)} className="group grid grid-cols-[10rem_1fr_2.5rem] items-center gap-3 text-sm">
                      <span className="flex items-center gap-2 text-text group-hover:text-primary">
                        <Icon className="size-4 text-text-muted" /> {CASE_STATUS_LABELS[p.status]}
                      </span>
                      <span className="h-2.5 rounded-full bg-surface-muted">
                        <span
                          className="block h-full rounded-full bg-primary/70 group-hover:bg-primary"
                          style={{ width: `${(p.count / maxStage) * 100}%`, minWidth: p.count ? 6 : 0 }}
                        />
                      </span>
                      <span className="text-right font-semibold tabular-nums">{p.count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
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
