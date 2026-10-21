import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

export const ENGINEER_SORTS = ["stageChangedAt", "jobsheetNo", "createdAt"] as const;

/** Stages an engineer works in: everything open on the branch track. */
const WORK_STAGES = ["DIAGNOSIS", "PENDING_APPROVAL", "AWAITING_STOCK", "QUALITY_CHECK"] as const;
const TAB_STAGES: Record<string, readonly (typeof WORK_STAGES)[number][]> = {
  diagnosis: ["DIAGNOSIS"],
  waiting: ["PENDING_APPROVAL", "AWAITING_STOCK"],
  qc: ["QUALITY_CHECK"],
};

const who = { select: { firstName: true, lastName: true } } as const;

/** Assigned cases (`scope` from engineerCaseScope), with tabs by stage. */
export async function listEngineerCases(list: ListState, scope: { branchId?: string; engineerId?: string }) {
  const base: Prisma.CaseWhereInput = { isDelete: 0, ...scope };
  const digits = list.q.replace(/\D/g, "");
  const search: Prisma.CaseWhereInput = list.q
    ? {
        OR: [
          { jobsheetNo: { contains: list.q, mode: "insensitive" } },
          { customer: { name: { contains: list.q, mode: "insensitive" } } },
          { brand: { contains: list.q, mode: "insensitive" } },
          { model: { contains: list.q, mode: "insensitive" } },
          { serialNo: { contains: list.q, mode: "insensitive" } },
          ...(digits ? [{ customer: { phone: { contains: digits } } }] : []),
        ],
      }
    : {};
  const stages = TAB_STAGES[list.tab] ?? WORK_STAGES;
  const where: Prisma.CaseWhereInput = { ...base, ...search, status: { in: [...stages] } };

  const [rows, total, grouped] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: [{ [list.sort]: list.dir }, { createdAt: "desc" }],
      include: {
        customer: { select: { name: true } },
        branch: { select: { code: true } },
        engineer: who,
        diagnosis: { select: { id: true } },
      },
      ...pageArgs(list),
    }),
    db.case.count({ where }),
    db.case.groupBy({ by: ["status"], where: { ...base, status: { in: [...WORK_STAGES] } }, _count: { _all: true } }),
  ]);
  const n = (...s: string[]) => grouped.filter((g) => s.includes(g.status)).reduce((t, g) => t + g._count._all, 0);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: n(...WORK_STAGES), isDefault: true },
    { key: "diagnosis", label: "Diagnosis", count: n("DIAGNOSIS") },
    { key: "waiting", label: "Waiting", count: n("PENDING_APPROVAL", "AWAITING_STOCK") },
    { key: "qc", label: "Quality Check", count: n("QUALITY_CHECK") },
  ];
  return { rows, total, tabs };
}

/** One assigned case with what the engineer needs: device, problem, estimate lines, diagnosis. */
export function getEngineerCase(id: string, scope: { branchId?: string; engineerId?: string }) {
  return db.case.findFirst({
    where: { id, isDelete: 0, ...scope },
    include: {
      customer: { select: { name: true } },
      branch: { select: { code: true, name: true } },
      engineer: who,
      receivedItems: { orderBy: { sortOrder: "asc" } },
      items: { where: { removedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, code: true, type: true, quantity: true } },
      diagnosis: { include: { savedBy: who } },
    },
  });
}
