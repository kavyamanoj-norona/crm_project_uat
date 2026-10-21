import "server-only";
import type { CurrentUser } from "@/server/auth/session";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { isEngineer } from "@/server/rbac/roles";

/**
 * Which cases the Engineer Workspace may touch: always inside the user's branch scope, and for an engineer only the ones
 * assigned to them. Branch managers and admins see every case of their scope. Spread into any case `where`.
 */
export async function engineerCaseScope(user: CurrentUser): Promise<{ branchId?: string; engineerId?: string }> {
  return { ...branchWhere(await getBranchScope(user)), ...(isEngineer(user) ? { engineerId: user.id } : {}) };
}
