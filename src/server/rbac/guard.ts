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

/** Permission of `user` on the active menu item at `path` (NONE if missing or inactive). */
export async function getMenuPermission(user: CurrentUser, path: string): Promise<Permission> {
  const menu = await db.menu.findUnique({
    where: { path },
    select: { id: true, isActive: true, module: { select: { isActive: true } } },
  });
  if (!menu || !menu.isActive || !menu.module.isActive) return NONE;
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
