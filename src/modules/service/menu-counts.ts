import "server-only";
import { db } from "@/server/db";
import { RULES, getNumberRule } from "@/server/rules";

// Sidebar badge counts for the Service menus. Branch-scoped like every list.

/** Cases still being worked on (not closed or cancelled). */
export const countOpenCases = (scope: { branchId?: string }) =>
  db.case.count({ where: { ...scope, status: { notIn: ["CLOSED", "CANCELLED"] } } });

/** Ready for delivery longer than the "Uncollected device after" rule. */
export async function countUncollected(scope: { branchId?: string }) {
  const days = await getNumberRule(RULES.uncollectedAfterDays, 15);
  return db.case.count({
    where: { ...scope, status: "READY_FOR_DELIVERY", stageChangedAt: { lt: new Date(Date.now() - days * 24 * 60 * 60 * 1000) } },
  });
}
