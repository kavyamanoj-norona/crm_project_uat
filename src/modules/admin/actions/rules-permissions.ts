"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import type { FormState } from "@/lib/form";
import { handleActionError } from "@/server/prisma-errors";
import { requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { ADMIN_PATHS } from "../paths";

const FLAGS = ["canView", "canCreate", "canEdit", "canDelete", "canApprove"] as const;

export async function savePermissionsFromRules(
  privilegeId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    const user = await requireActionPermission(ADMIN_PATHS.privileges, "canEdit");
    const menuIds = formData.getAll("menuIds").map(String);

    const valid = await db.menu.findMany({ where: { id: { in: menuIds }, type: "ITEM" }, select: { id: true } });
    const validIds = new Set(valid.map((m) => m.id));

    await db.$transaction(
      menuIds
        .filter((id) => validIds.has(id))
        .map((menuId) => {
          const flags = Object.fromEntries(FLAGS.map((f) => [f, formData.get(`p.${menuId}.${f}`) === "on"])) as Record<
            (typeof FLAGS)[number],
            boolean
          >;
          if (FLAGS.some((f) => flags[f])) flags.canView = true;
          return db.privilegePermission.upsert({
            where: { privilegeId_menuId: { privilegeId, menuId } },
            update: flags,
            create: { privilegeId, menuId, ...flags },
          });
        }),
    );

    await logActivity({ action: "privilege.permissions", userId: user.id, entity: "Privilege", entityId: privilegeId });
  } catch (e) {
    return handleActionError(e);
  }

  revalidatePath("/", "layout");
  redirect(`${ADMIN_PATHS.rules}?privilege=${privilegeId}&saved=${Date.now()}`);
}
