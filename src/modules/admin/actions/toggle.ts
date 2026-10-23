"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { ActionResult } from "@/lib/form";
import { ADMIN_PATHS } from "../paths";
import { INVENTORY_PATHS } from "../../inventory/paths";

type SoftDeletable = {
  findUnique(args: { where: { id: string }; select: { id: true } }): Promise<{ id: string } | null>;
  update(args: { where: { id: string }; data: { isDelete: number } }): Promise<unknown>;
};

const TARGETS = {
  company: { path: ADMIN_PATHS.companies, model: () => db.company },
  branch: { path: ADMIN_PATHS.branches, model: () => db.branch },
  domain: { path: ADMIN_PATHS.domains, model: () => db.domain },
  department: { path: ADMIN_PATHS.departments, model: () => db.department },
  privilege: { path: ADMIN_PATHS.privileges, model: () => db.privilege },
  module: { path: ADMIN_PATHS.modules, model: () => db.module },
  menu: { path: ADMIN_PATHS.modules, model: () => db.menu },
  blockedIp: { path: ADMIN_PATHS.blockedIps, model: () => db.blockedIp },
  rule: { path: ADMIN_PATHS.rules, model: () => db.rule },
  item: { path: INVENTORY_PATHS.items, model: () => db.item },
  itemCategory: { path: INVENTORY_PATHS.categories, model: () => db.itemCategory },
} as const;

export type ToggleTarget = keyof typeof TARGETS;

/** Soft delete — sets `isDelete = 1`; the row stays in the database and drops out of every list. */
export async function deleteRecord(target: ToggleTarget, id: string): Promise<ActionResult> {
  const t = TARGETS[target];
  if (!t) return { ok: false, message: "Unknown record type." };
  try {
    const user = await requireActionPermission(t.path, "canEdit");
    // Don't let an admin delete the privilege they are signed in with.
    if (target === "privilege" && id === user.privilege.id) {
      return { ok: false, message: "You can't delete the privilege you are signed in with." };
    }

    // A category still holding live items can't be deleted: move those items first.
    if (target === "itemCategory") {
      const used = await db.item.count({ where: { categoryId: id, isDelete: 0 } });
      if (used > 0) return { ok: false, message: `${used} ${used === 1 ? "item uses" : "items use"} this category. Move them to another category first.` };
    }

    const model = t.model() as unknown as SoftDeletable;
    const row = await model.findUnique({ where: { id }, select: { id: true } });
    if (!row) return { ok: false, message: "Record not found." };
    await model.update({ where: { id }, data: { isDelete: 1 } });

    await logActivity({ action: `${target}.delete`, userId: user.id, entity: target, entityId: id });
    revalidatePath("/", "layout"); // menus/modules affect the shell everywhere
    return { ok: true, message: `${LABELS[target]} deleted.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

const LABELS: Record<ToggleTarget, string> = {
  company: "Company",
  branch: "Branch",
  domain: "Domain",
  department: "Department",
  privilege: "Privilege",
  module: "Module",
  menu: "Menu",
  blockedIp: "IP block",
  rule: "Rule",
  item: "Item",
  itemCategory: "Category",
};
