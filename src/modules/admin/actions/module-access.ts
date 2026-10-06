"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { handleActionError } from "@/server/prisma-errors";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { ADMIN_PATHS } from "../paths";

/** Returns all active modules with whether this privilege has canView on any menu in each module. */
export async function getModulesForPrivilege(privilegeId: string) {
  const [modules, permissions] = await Promise.all([
    db.module.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
      include: { menus: { where: { type: "ITEM" }, select: { id: true } } },
    }),
    db.privilegePermission.findMany({
      where: { privilegeId, canView: true },
      select: { menuId: true },
    }),
  ]);

  const grantedIds = new Set(permissions.map((p) => p.menuId));
  return modules.map((m) => ({
    id: m.id,
    title: m.title,
    hasAccess: m.menus.some((menu) => grantedIds.has(menu.id)),
  }));
}

/** Grants canView for all menus in a module (enable) or removes all permissions for them (disable). */
export async function toggleModuleAccess(privilegeId: string, moduleId: string, enabled: boolean) {
  try {
    const user = await requireActionPermission(ADMIN_PATHS.privileges, "canEdit");
    const menus = await db.menu.findMany({
      where: { moduleId, type: "ITEM" },
      select: { id: true },
    });

    if (enabled) {
      await Promise.all(
        menus.map((menu) =>
          db.privilegePermission.upsert({
            where: { privilegeId_menuId: { privilegeId, menuId: menu.id } },
            create: { privilegeId, menuId: menu.id, canView: true },
            update: { canView: true },
          }),
        ),
      );
    } else {
      await db.privilegePermission.deleteMany({
        where: { privilegeId, menuId: { in: menus.map((m) => m.id) } },
      });
    }

    await logActivity({
      action: "privilege.module-access",
      userId: user.id,
      entity: "Privilege",
      entityId: privilegeId,
    });
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath("/", "layout");
}
