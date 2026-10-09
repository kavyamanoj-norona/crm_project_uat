import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/session";

export const BRANCH_COOKIE = "lc_branch";

export type BranchOption = { id: string; code: string; name: string };

export type BranchScope = {
  /** The branch whose data is shown; null = all branches. */
  branchId: string | null;
  branch: BranchOption | null;
  /** Admin / all-branch privileges may switch; branch-bound users may not. */
  canSwitch: boolean;
};

/**
 * The branch the current request is scoped to (blueprint §10).
 * - Branch-bound users: always their own branch — the cookie is ignored.
 * - Everyone else: the branch picked in the header switcher, or all branches.
 */
export const getBranchScope = cache(async (user: CurrentUser): Promise<BranchScope> => {
  if (user.privilege.isBranchBound) {
    return { branchId: user.branchId, branch: user.branch, canSwitch: false };
  }
  const picked = (await cookies()).get(BRANCH_COOKIE)?.value;
  if (!picked) return { branchId: null, branch: null, canSwitch: true };

  const branch = await db.branch.findFirst({
    where: { id: picked, isActive: true },
    select: { id: true, code: true, name: true },
  });
  return { branchId: branch?.id ?? null, branch, canSwitch: true };
});

/**
 * Prisma `where` fragment for branch-owned rows. Use it in every query of a
 * model with a `branchId` column: `where: { ...branchWhere(scope), … }`.
 */
export function branchWhere(scope: BranchScope): { branchId?: string } {
  return scope.branchId ? { branchId: scope.branchId } : {};
}

/**
 * Customers a branch can see: the ones it registered, plus anyone it has a case
 * for (so its own jobs always link to a visible customer). All branches = no filter.
 */
export function customerWhere(scope: Pick<BranchScope, "branchId">): Prisma.CustomerWhereInput {
  // Leads share the table but are not customers until converted.
  return scope.branchId
    ? { kind: "CUSTOMER", OR: [{ branchId: scope.branchId }, { cases: { some: { branchId: scope.branchId } } }] }
    : { kind: "CUSTOMER" };
}

/**
 * Leads a branch can see: its own plus unassigned ones (website enquiries have
 * no branch yet). All branches = no filter. Always combine with a leadCode filter.
 */
export function leadWhere(scope: Pick<BranchScope, "branchId">): Prisma.CustomerWhereInput {
  return scope.branchId ? { OR: [{ branchId: scope.branchId }, { branchId: null }] } : {};
}

export const listBranchOptions = () =>
  db.branch.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
