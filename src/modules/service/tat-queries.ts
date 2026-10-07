import { db } from "@/server/db";
import type { CaseStatus } from "@/generated/prisma/client";
export { TAT_STAGES } from "@/modules/service/tat-schema";

export async function listTatConfigs() {
  return db.tatConfig.findMany({
    orderBy: { status: "asc" },
    include: { updatedBy: { select: { firstName: true, lastName: true } } },
  });
}

export async function getTatConfigMap(): Promise<Map<CaseStatus, { targetMinutes: number; warningThreshold: number; escalationThreshold: number; isActive: boolean }>> {
  const configs = await db.tatConfig.findMany({ where: { isActive: true } });
  const map = new Map();
  for (const c of configs) {
    const mult = c.targetUnit === "MINUTES" ? 1 : c.targetUnit === "HOURS" ? 60 : 1440;
    map.set(c.status, {
      targetMinutes: c.targetValue * mult,
      warningThreshold: c.warningThreshold,
      escalationThreshold: c.escalationThreshold,
      isActive: c.isActive,
    });
  }
  return map;
}

export type TatStatus = "WITHIN" | "APPROACHING" | "OVERDUE" | "NO_CONFIG";

export function computeTatStatus(
  stageChangedAt: Date,
  config: { targetMinutes: number; warningThreshold: number; escalationThreshold: number } | undefined,
): { status: TatStatus; elapsedMinutes: number; remainingMinutes: number | null; percentUsed: number | null } {
  const elapsedMinutes = Math.floor((Date.now() - stageChangedAt.getTime()) / 60000);
  if (!config) return { status: "NO_CONFIG", elapsedMinutes, remainingMinutes: null, percentUsed: null };
  const { targetMinutes, warningThreshold, escalationThreshold } = config;
  const percentUsed = Math.round((elapsedMinutes / targetMinutes) * 100);
  const remainingMinutes = targetMinutes - elapsedMinutes;
  let status: TatStatus;
  if (percentUsed >= escalationThreshold) status = "OVERDUE";
  else if (percentUsed >= warningThreshold) status = "APPROACHING";
  else status = "WITHIN";
  return { status, elapsedMinutes, remainingMinutes, percentUsed };
}

export type AgeingRow = {
  id: string;
  jobsheetNo: string;
  customerName: string;
  status: CaseStatus;
  stageChangedAt: Date;
  engineerName: string | null;
  branchName: string;
  tatStatus: TatStatus;
  elapsedMinutes: number;
  remainingMinutes: number | null;
  percentUsed: number | null;
  targetMinutes: number | null;
};

export async function listAgeingCases(filters: {
  q?: string;
  status?: CaseStatus | "";
  tatStatus?: TatStatus | "";
  branchId?: string;
}): Promise<AgeingRow[]> {
  const tatMap = await getTatConfigMap();

  const where: Record<string, unknown> = {
    status: { notIn: ["CLOSED", "CANCELLED"] as CaseStatus[] },
  };
  if (filters.branchId) where.branchId = filters.branchId;
  if (filters.status) where.status = filters.status;
  if (filters.q) {
    where.OR = [
      { jobsheetNo: { contains: filters.q, mode: "insensitive" } },
      { customer: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }

  const cases = await db.case.findMany({
    where,
    select: {
      id: true,
      jobsheetNo: true,
      status: true,
      stageChangedAt: true,
      customer: { select: { name: true } },
      engineer: { select: { firstName: true, lastName: true } },
      branch: { select: { name: true } },
    },
    orderBy: { stageChangedAt: "asc" },
    take: 500,
  });

  const rows: AgeingRow[] = cases.map((c) => {
    const config = tatMap.get(c.status);
    const tat = computeTatStatus(c.stageChangedAt, config);
    return {
      id: c.id,
      jobsheetNo: c.jobsheetNo,
      customerName: c.customer.name,
      status: c.status,
      stageChangedAt: c.stageChangedAt,
      engineerName: c.engineer ? [c.engineer.firstName, c.engineer.lastName].filter(Boolean).join(" ") : null,
      branchName: c.branch.name,
      tatStatus: tat.status,
      elapsedMinutes: tat.elapsedMinutes,
      remainingMinutes: tat.remainingMinutes,
      percentUsed: tat.percentUsed,
      targetMinutes: config?.targetMinutes ?? null,
    };
  });

  if (filters.tatStatus) return rows.filter((r) => r.tatStatus === filters.tatStatus);
  return rows;
}
