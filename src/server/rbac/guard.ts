import "server-only";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getCurrentUser, requireUser, type CurrentUser } from "@/server/auth/session";

export type Permission = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

export type PermissionFlag = keyof Permission;

export const ALL: Permission = { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true };
export const NONE: Permission = { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false };

export class ForbiddenError extends Error {
  constructor() {
    super("You don't have permission to do that.");
  }
}

/** "/a/b/c" → ["/a", "/a/b", "/a/b/c"] */
export function pathPrefixes(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((_, i) => `/${parts.slice(0, i + 1).join("/")}`);
}

/**
 * Permission of `user` on the page at `path`. The deepest active menu item
 * whose path is a prefix of `path` owns it, so sub-pages such as
 * /admin/companies/branches inherit the permission of /admin/companies.
 */
export async function getMenuPermission(user: CurrentUser, path: string): Promise<Permission> {
  const menus = await db.menu.findMany({
    where: { type: "ITEM", isActive: true, path: { in: pathPrefixes(path) }, module: { isActive: true } },
    select: { id: true, path: true },
  });
  const menu = menus.sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];
  if (!menu) return NONE;
  if (user.privilege.isSuperAdmin) return ALL;

  const row = await db.privilegePermission.findUnique({
    where: { privilegeId_menuId: { privilegeId: user.privilege.id, menuId: menu.id } },
    select: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
  });
  return row ?? NONE;
}

/** For pages: signed-in user with canView on `path`, else redirect to /forbidden. */
export async function requirePageAccess(path: string) {
  const user = await requireUser();
  const permission = await getMenuPermission(user, path);
  if (!permission.canView) redirect("/forbidden");
  return { user, permission };
}

/** For server actions: throws ForbiddenError unless the user has `flag` on `path`. */
export async function requireActionPermission(path: string, flag: PermissionFlag) {
  const user = await getCurrentUser();
  if (!user) throw new ForbiddenError();
  const permission = await getMenuPermission(user, path);
  if (!permission.canView || !permission[flag]) throw new ForbiddenError();
  return user;
}
