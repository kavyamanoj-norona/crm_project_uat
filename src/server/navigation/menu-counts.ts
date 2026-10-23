import "server-only";
import { flattenItems, type NavModule } from "@/lib/navigation";
import { SERVICE_PATHS } from "@/modules/service/paths";
import { countOpenCases, countUncollected } from "@/modules/service/menu-counts";
import { countOpenApprovals } from "@/modules/service/approval-queries";
import { approvalKinds } from "@/modules/service/approval-access";
import type { CurrentUser } from "@/server/auth/session";

type Counter = (scope: { branchId?: string }, user: CurrentUser) => Promise<number>;

/** Menu path → badge count. Add an entry to show a number next to a sidebar item. */
const COUNTERS: Record<string, Counter> = {
  [SERVICE_PATHS.cases]: countOpenCases,
  [SERVICE_PATHS.uncollected]: countUncollected,
  // Requests waiting on this user: Head Office manual approvals, or the lab quotes of their branch.
  [SERVICE_PATHS.approvals]: (scope, user) => countOpenApprovals(scope.branchId ?? null, approvalKinds(user)),
};

/** Counts for the menu items this user can see (others are never queried). */
export async function getMenuCounts(nav: NavModule[], scope: { branchId?: string }, user: CurrentUser): Promise<Record<string, number>> {
  const paths = nav.flatMap((m) => flattenItems(m).map((i) => i.path)).filter((p) => p in COUNTERS);
  const values = await Promise.all(paths.map((p) => COUNTERS[p]!(scope, user)));
  return Object.fromEntries(paths.map((p, i) => [p, values[i]!]));
}
