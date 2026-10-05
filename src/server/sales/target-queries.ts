import "server-only";
import { db } from "@/server/db";
import type { TargetPeriod } from "@/generated/prisma/client";

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
