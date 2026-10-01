"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { ActionResult } from "@/lib/form";
import { ADMIN_PATHS } from "../paths";

type Toggleable = {
  findUnique(args: { where: { id: string }; select: { isActive: true } }): Promise<{ isActive: boolean } | null>;
  update(args: { where: { id: string }; data: { isActive: boolean } }): Promise<unknown>;
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
  item: { path: ADMIN_PATHS.items, model: () => db.item },
} as const;

export type ToggleTarget = keyof typeof TARGETS;

/** Flips `isActive` — the only way records are "removed" (no hard deletes). */
export async function toggleActive(target: ToggleTarget, id: string): Promise<ActionResult> {
  const t = TARGETS[target];
  if (!t) return { ok: false, message: "Unknown record type." };
  try {
    const user = await requireActionPermission(t.path, "canEdit");
    // Don't let an admin switch off the privilege they are signed in with.
    if (target === "privilege" && id === user.privilege.id) {
      return { ok: false, message: "You can't deactivate the privilege you are signed in with." };
    }

    const model = t.model() as unknown as Toggleable;
    const row = await model.findUnique({ where: { id }, select: { isActive: true } });
    if (!row) return { ok: false, message: "Record not found." };
    await model.update({ where: { id }, data: { isActive: !row.isActive } });

    await logActivity({
      action: `${target}.${row.isActive ? "deactivate" : "activate"}`,
      userId: user.id,
      entity: target,
      entityId: id,
    });
    revalidatePath("/", "layout"); // menus/modules affect the shell everywhere
    const name = LABELS[target];
    return { ok: true, message: row.isActive ? `${name} deactivated.` : `${name} activated.` };
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
};
