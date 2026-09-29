import "server-only";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/session";
import type { NavModule } from "@/lib/navigation";

export type ResolvedRoute =
  | { status: "ok"; module: NavModule; groupTitle?: string; itemTitle: string; menuCode: string; permission: Permission }
  | { status: "redirect"; to: string }
  | { status: "forbidden" }
  | { status: "not-found" };

export type Permission = {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canApprove: boolean;
};

const ALL: Permission = { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true };
const NONE: Permission = { canView: false, canCreate: false, canEdit: false, canDelete: false, canApprove: false };

/** "/a/b/c" → ["/a", "/a/b", "/a/b/c"] */
function prefixes(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);
  return parts.map((_, i) => `/${parts.slice(0, i + 1).join("/")}`);
}

/**
 * Decides what a URL inside the shell maps to, using the menu table as the
 * source of truth. The deepest menu item whose path is a prefix of the URL
 * owns the page; the user needs canView on that item.
 */
export async function resolveRoute(
  user: CurrentUser,
  nav: NavModule[],
  pathname: string,
): Promise<ResolvedRoute> {
  const candidates = prefixes(pathname);

  const menus = await db.menu.findMany({
    where: { type: "ITEM", isActive: true, path: { in: candidates }, module: { isActive: true } },
    include: { parent: { select: { title: true } } },
  });
  const menu = menus.sort((a, b) => (b.path?.length ?? 0) - (a.path?.length ?? 0))[0];

  if (!menu) {
    // A bare module URL ("/service") lands on the module's first permitted item.
    const landing = nav.find((m) => m.path === pathname);
    if (landing) return { status: "redirect", to: landing.href };
    const exists = await db.module.findFirst({ where: { path: pathname, isActive: true } });
    return exists ? { status: "forbidden" } : { status: "not-found" };
  }

  const navModule = nav.find((m) => m.id === menu.moduleId);
  const visible = navModule?.entries.some((e) =>
    e.kind === "item" ? e.id === menu.id : e.items.some((i) => i.id === menu.id),
  );
  if (!navModule || !visible) return { status: "forbidden" };

  const permission = user.role.isSuperAdmin
    ? ALL
    : ((await db.rolePermission.findUnique({
        where: { roleId_menuId: { roleId: user.role.id, menuId: menu.id } },
        select: { canView: true, canCreate: true, canEdit: true, canDelete: true, canApprove: true },
      })) ?? NONE);

  return {
    status: "ok",
    module: navModule,
    groupTitle: menu.parent?.title,
    itemTitle: menu.title,
    menuCode: menu.code,
    permission,
  };
}
