import "server-only";
import { db } from "@/server/db";
import type { Prisma, TargetPeriod } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

export type TargetFilter = {
  period: TargetPeriod;
  year: number;
  month?: number;
  day?: number;
};

export async function listSalesTargets(filter?: Partial<TargetFilter>) {
  return db.salesTarget.findMany({
    where: {
      isActive: true,
      ...(filter?.period ? { period: filter.period } : {}),
      ...(filter?.year ? { year: filter.year } : {}),
      ...(filter?.month !== undefined ? { month: filter.month } : {}),
      ...(filter?.day !== undefined ? { day: filter.day } : {}),
    },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ year: "desc" }, { month: "desc" }, { day: "desc" }, { branch: { name: "asc" } }],
  });
}

export async function listActiveBranches() {
  return db.branch.findMany({
    where: { isActive: true },
    orderBy: [{ isVirtual: "asc" }, { name: "asc" }],
    select: { id: true, code: true, name: true, isVirtual: true },
  });
}

export type SalesTargetRow = Awaited<ReturnType<typeof listSalesTargets>>[number];

export const TARGET_SORTS = ["year", "branch", "targetPaise", "createdAt"] as const;

/** One page of targets. `list.tab` is the period (DAILY / MONTHLY / YEARLY); search matches branch name or code. */
export async function listSalesTargetsPage(list: ListState) {
  const period: Prisma.SalesTargetWhereInput =
    list.tab === "DAILY" || list.tab === "MONTHLY" || list.tab === "YEARLY" ? { period: list.tab } : {};
  const search: Prisma.SalesTargetWhereInput = list.q
    ? { OR: [{ branch: { name: { contains: list.q, mode: "insensitive" } } }, { branch: { code: { contains: list.q, mode: "insensitive" } } }] }
    : {};
  const where: Prisma.SalesTargetWhereInput = { AND: [search, period] };
  const orderBy: Prisma.SalesTargetOrderByWithRelationInput[] =
    list.sort === "branch"
      ? [{ branch: { name: list.dir } }]
      : list.sort === "year"
        ? [{ year: list.dir }, { month: { sort: list.dir, nulls: "last" } }, { day: { sort: list.dir, nulls: "last" } }]
        : [{ [list.sort]: list.dir }];

  const [rows, total, all, daily, monthly, yearly] = await Promise.all([
    db.salesTarget.findMany({
      where,
      orderBy,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      ...pageArgs(list),
    }),
    db.salesTarget.count({ where }),
    db.salesTarget.count({ where: search }),
    ...(["DAILY", "MONTHLY", "YEARLY"] as const).map((p) => db.salesTarget.count({ where: { AND: [search, { period: p }] } })),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "DAILY", label: "Daily", count: daily },
    { key: "MONTHLY", label: "Monthly", count: monthly },
    { key: "YEARLY", label: "Yearly", count: yearly },
  ];
  return { rows, total, tabs };
}

export type SalesTargetPageRow = Awaited<ReturnType<typeof listSalesTargetsPage>>["rows"][number];
