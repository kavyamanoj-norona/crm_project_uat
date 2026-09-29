import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import type { CurrentUser } from "@/server/auth/session";
import type { NavEntry, NavItem, NavModule } from "@/lib/navigation";

/**
 * Builds the rail + sidebar tree for a user straight from the database.
 * - ITEM   visible when the privilege has canView on it (super-admin sees all)
 * - GROUP  visible when it has at least one visible item
 * - MODULE visible when it has at least one visible item
 */
export const getNavigation = cache(async (user: CurrentUser): Promise<NavModule[]> => {
  const [modules, permitted] = await Promise.all([
    db.module.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: {
        menus: {
          where: { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
        },
      },
    }),
    user.privilege.isSuperAdmin
      ? Promise.resolve(null)
      : db.privilegePermission.findMany({
          where: { privilegeId: user.privilege.id, canView: true },
          select: { menuId: true },
        }),
  ]);

  const allowed = permitted ? new Set(permitted.map((p) => p.menuId)) : null;
  const canView = (menuId: string) => allowed === null || allowed.has(menuId);

  const result: NavModule[] = [];

  for (const mod of modules) {
    const toItem = (m: (typeof mod.menus)[number]): NavItem | null =>
      m.type === "ITEM" && m.path && canView(m.id)
        ? { kind: "item", id: m.id, code: m.code, title: m.title, icon: m.icon, path: m.path }
        : null;

    const entries: NavEntry[] = [];
    for (const menu of mod.menus.filter((m) => m.parentId === null)) {
      if (menu.type === "ITEM") {
        const item = toItem(menu);
        if (item) entries.push(item);
        continue;
      }
      const items = mod.menus
        .filter((m) => m.parentId === menu.id)
        .map(toItem)
        .filter((i): i is NavItem => i !== null);
      if (items.length > 0) {
        entries.push({
          kind: "group",
          id: menu.id,
          code: menu.code,
          title: menu.title,
          icon: menu.icon,
          items,
        });
      }
    }

    const first = entries[0];
    if (!first) continue; // nothing permitted → hide the module
    result.push({
      id: mod.id,
      code: mod.code,
      title: mod.title,
      icon: mod.icon,
      path: mod.path,
      href: first.kind === "item" ? first.path : first.items[0]!.path,
      entries,
    });
  }

  return result;
});
