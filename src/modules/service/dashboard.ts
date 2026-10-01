import "server-only";
import { db } from "@/server/db";
import type { ReportPeriod } from "@/lib/report-period";
import { caseAge, type TatLimits } from "./case-age";
import { CASE_FLOW, isOpenStatus, type CaseStatusValue } from "./case-schema";

// Numbers for the Service dashboard. Two kinds:
// - period figures follow the report filter (new cases, diagnosed, closed, collected, trend)
// - live figures are "right now" (receivables awaiting pickup, aging, stage counts)
// Everything is limited to the branch scope.

const DAY_MS = 24 * 60 * 60 * 1000;

const due = (c: { estimatedCostPaise: number | null; payments: { amountPaise: number }[] }) =>
  Math.max(0, (c.estimatedCostPaise ?? 0) - c.payments.reduce((s, p) => s + p.amountPaise, 0));

export async function getServiceDashboard(period: ReportPeriod, scope: { branchId?: string }, tat: TatLimits) {
  const inPeriod = { gte: period.from, lt: period.to };
  const inPrevious = { gte: period.previous.from, lt: period.previous.to };
  const trendFrom = period.buckets[0]!.from;
  const trendTo = period.buckets.at(-1)!.to;
  const caseScope = { case: scope };

  const [newCases, previousCases, byIntake, diagnosed, sentBack, closed, collected, trendRows, open] = await Promise.all([
    db.case.count({ where: { ...scope, createdAt: inPeriod } }),
    db.case.count({ where: { ...scope, createdAt: inPrevious } }),
    db.case.groupBy({ by: ["intakeType"], where: { ...scope, createdAt: inPeriod }, _count: { _all: true } }),
    db.caseStatusHistory.count({ where: { ...caseScope, fromStatus: "DIAGNOSIS", toStatus: { not: "CANCELLED" }, at: inPeriod } }),
    db.caseStatusHistory.count({
      where: { ...caseScope, fromStatus: "QUALITY_CHECK", toStatus: { in: ["DIAGNOSIS", "PENDING_APPROVAL", "AWAITING_STOCK"] }, at: inPeriod },
    }),
    db.caseStatusHistory.count({ where: { ...caseScope, toStatus: "CLOSED", at: inPeriod } }),
    db.payment.aggregate({ where: { ...scope, createdAt: inPeriod }, _sum: { amountPaise: true } }),
    db.case.findMany({ where: { ...scope, createdAt: { gte: trendFrom, lt: trendTo } }, select: { createdAt: true } }),
    db.case.findMany({
      where: { ...scope, status: { notIn: ["CLOSED", "CANCELLED"] } },
      select: { status: true, stageChangedAt: true, estimatedCostPaise: true, payments: { select: { amountPaise: true } } },
    }),
  ]);

  // Live: stage counts, receivables awaiting pickup, aging
  const now = new Date();
  const byStage = new Map<CaseStatusValue, number>();
  let readyDue = 0;
  let aging = 0;
  let agingDue = 0;
  let pendingOverdue = 0;
  let stockOverTwoDays = 0;
  for (const c of open) {
    byStage.set(c.status, (byStage.get(c.status) ?? 0) + 1);
    if (c.status === "READY_FOR_DELIVERY") readyDue += due(c);
    if (caseAge(c.status, c.stageChangedAt, tat, now)?.overdue) {
      aging++;
      agingDue += due(c);
      if (c.status === "PENDING_APPROVAL") pendingOverdue++;
    }
    if (c.status === "AWAITING_STOCK" && now.getTime() - c.stageChangedAt.getTime() > 2 * DAY_MS) stockOverTwoDays++;
  }

  const trend = period.buckets.map((b) => ({
    label: b.label,
    value: trendRows.filter((r) => r.createdAt >= b.from && r.createdAt < b.to).length,
    highlight: b.label === "Today",
  }));
  // Without a "Today" column, emphasise the last one (the picked day / latest day or month).
  if (!trend.some((t) => t.highlight) && trend.length) trend.at(-1)!.highlight = true;

  const intake = Object.fromEntries(byIntake.map((g) => [g.intakeType, g._count._all])) as Partial<Record<string, number>>;

  return {
    newCases,
    delta: newCases - previousCases,
    intake,
    diagnosed,
    inDiagnosis: byStage.get("DIAGNOSIS") ?? 0,
    ready: { count: byStage.get("READY_FOR_DELIVERY") ?? 0, duePaise: readyDue },
    aging: { count: aging, duePaise: agingDue },
    pending: { count: byStage.get("PENDING_APPROVAL") ?? 0, overdue: pendingOverdue },
    awaitingStock: { count: byStage.get("AWAITING_STOCK") ?? 0, overTwoDays: stockOverTwoDays },
    quality: { count: byStage.get("QUALITY_CHECK") ?? 0, sentBack },
    closed: { count: closed, collectedPaise: collected._sum.amountPaise ?? 0 },
    pipeline: CASE_FLOW.filter(isOpenStatus).map((s) => ({ status: s, count: byStage.get(s) ?? 0 })),
    openTotal: open.length,
    trend,
  };
}

/** Years the filter offers: from the first case (or last year) to now, newest first. */
export async function reportYears(scope: { branchId?: string }, currentYear: number) {
  const first = await db.case.findFirst({ where: scope, orderBy: { createdAt: "asc" }, select: { createdAt: true } });
  const start = Math.min(first ? first.createdAt.getUTCFullYear() : currentYear, currentYear - 1);
  return Array.from({ length: currentYear - start + 1 }, (_, i) => currentYear - i);
}
