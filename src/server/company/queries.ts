import "server-only";
import { db } from "@/server/db";

// Week date range helpers — returns Monday 00:00 → Sunday 23:59 UTC+local
function weekRange(weeksAgo: number): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon - weeksAgo * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}

export type OwnerDashboardBranchRow = {
  branch: { id: string; name: string; code: string; isVirtual: boolean };
  newCases: number;
  revenuePaise: number;
  prevRevenuePaise: number;
  avgTat: number | null;
  prevAvgTat: number | null;
  agingCases: number;
  uncollected: number;
  stockValuePaise: number;
};

export type OwnerDashboardData = {
  totalRevenuePaise: number;
  prevRevenuePaise: number;
  avgTat: number | null;
  prevAvgTat: number | null;
  stockValuePaise: number;
  branches: OwnerDashboardBranchRow[];
};

/**
 * All-branch owner dashboard metrics.
 * @param week 0 = this week, 1 = last week, etc.
 */
export async function getOwnerDashboard(week: number): Promise<OwnerDashboardData> {
  const cur = weekRange(week);
  const prev = weekRange(week + 1);

  // All active branches
  const branches = await db.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, isVirtual: true },
    orderBy: { name: "asc" },
  });

  // Revenue (payments) for current and previous week, grouped by branch
  const [curPayments, prevPayments] = await Promise.all([
    db.payment.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: cur.start, lte: cur.end } },
      _sum: { amountPaise: true },
    }),
    db.payment.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: prev.start, lte: prev.end } },
      _sum: { amountPaise: true },
    }),
  ]);

  const curRevMap = new Map(curPayments.map((r) => [r.branchId, r._sum.amountPaise ?? 0]));
  const prevRevMap = new Map(prevPayments.map((r) => [r.branchId, r._sum.amountPaise ?? 0]));

  // New cases created this week per branch (Case has no isActive; filter by creation date only)
  const newCasesRows = await db.case.groupBy({
    by: ["branchId"],
    where: { createdAt: { gte: cur.start, lte: cur.end } },
    _count: { id: true },
  });
  const newCasesMap = new Map(newCasesRows.map((r) => [r.branchId, r._count.id]));

  // Aging: open cases where stageChangedAt is more than 5 days ago
  const agingCutoff = new Date();
  agingCutoff.setDate(agingCutoff.getDate() - 5);

  const agingRows = await db.case.groupBy({
    by: ["branchId"],
    where: {
      stageChangedAt: { lt: agingCutoff },
      status: { notIn: ["CLOSED", "CANCELLED"] },
    },
    _count: { id: true },
  });
  const agingMap = new Map(agingRows.map((r) => [r.branchId, r._count.id]));

  // TAT: avg days from createdAt to updatedAt for cases closed in the target week
  const [closedCur, closedPrev] = await Promise.all([
    db.case.findMany({
      where: { status: "CLOSED", updatedAt: { gte: cur.start, lte: cur.end } },
      select: { branchId: true, createdAt: true, updatedAt: true },
    }),
    db.case.findMany({
      where: { status: "CLOSED", updatedAt: { gte: prev.start, lte: prev.end } },
      select: { branchId: true, createdAt: true, updatedAt: true },
    }),
  ]);

  function tatDays(c: { createdAt: Date; updatedAt: Date }) {
    return (c.updatedAt.getTime() - c.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  }

  function avgTatForBranch(
    rows: Array<{ branchId: string; createdAt: Date; updatedAt: Date }>,
    branchId: string,
  ): number | null {
    const filtered = rows.filter((r) => r.branchId === branchId);
    if (filtered.length === 0) return null;
    return filtered.reduce((s, r) => s + tatDays(r), 0) / filtered.length;
  }

  function avgTatAll(
    rows: Array<{ branchId: string; createdAt: Date; updatedAt: Date }>,
  ): number | null {
    if (rows.length === 0) return null;
    return rows.reduce((s, r) => s + tatDays(r), 0) / rows.length;
  }

  // Stock value: sum of quantity × item.pricePaise per branch
  const stockItems = await db.stockItem.findMany({
    where: { quantity: { gt: 0 }, branch: { isActive: true } },
    select: { branchId: true, quantity: true, item: { select: { pricePaise: true } } },
  });

  const stockMap = new Map<string, number>();
  for (const si of stockItems) {
    stockMap.set(si.branchId, (stockMap.get(si.branchId) ?? 0) + si.quantity * si.item.pricePaise);
  }

  // Uncollected: non-closed cases that have at least one payment (grouped manually)
  const uncollectedCases = await db.case.findMany({
    where: {
      status: { notIn: ["CLOSED", "CANCELLED"] },
      payments: { some: {} },
    },
    select: { branchId: true },
  });
  const uncollectedMap = new Map<string, number>();
  for (const c of uncollectedCases) {
    uncollectedMap.set(c.branchId, (uncollectedMap.get(c.branchId) ?? 0) + 1);
  }

  const branchRows: OwnerDashboardBranchRow[] = branches.map((b) => ({
    branch: b,
    newCases: newCasesMap.get(b.id) ?? 0,
    revenuePaise: curRevMap.get(b.id) ?? 0,
    prevRevenuePaise: prevRevMap.get(b.id) ?? 0,
    avgTat: avgTatForBranch(closedCur, b.id),
    prevAvgTat: avgTatForBranch(closedPrev, b.id),
    agingCases: agingMap.get(b.id) ?? 0,
    uncollected: uncollectedMap.get(b.id) ?? 0,
    stockValuePaise: stockMap.get(b.id) ?? 0,
  }));

  return {
    totalRevenuePaise: branchRows.reduce((s, r) => s + r.revenuePaise, 0),
    prevRevenuePaise: branchRows.reduce((s, r) => s + r.prevRevenuePaise, 0),
    avgTat: avgTatAll(closedCur),
    prevAvgTat: avgTatAll(closedPrev),
    stockValuePaise: branchRows.reduce((s, r) => s + r.stockValuePaise, 0),
    branches: branchRows,
  };
}
