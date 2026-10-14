import "server-only";
import type { CurrentUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/rbac/guard";

/** The Purchasing section (stock USIDs, allocating them to cases) is for the Purchase Manager, plus admins. */
export function isPurchaseManager(user: CurrentUser) {
  return user.privilege.isSuperAdmin || user.privilege.code === "PURCHASE_MANAGER";
}

export function requirePurchaseManager(user: CurrentUser) {
  if (!isPurchaseManager(user)) throw new ForbiddenError();
}
