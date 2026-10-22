"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { ActionResult } from "@/lib/form";
import { formatPaise, optionalRupees } from "@/lib/money";
import { BILLING_EDIT_STATUSES } from "../case-schema";
import { cameFromChipLab } from "../billing-guard";
import { SERVICE_PATHS } from "../paths";

/**
 * Saves the billed price per unit of one or more lines from the billing table, all or nothing. Only each line's
 * minimum selling price is enforced (there is no maximum). Line totals and the case estimate (which GST is worked out
 * from) are recalculated in the same transaction, and each change is written to the activity log as old → new. On a
 * case that came back from the chip-level lab only the service charge lines can be changed.
 */
export async function saveBilledAmounts(caseId: string, input: { id: string; unitPrice: string }[]): Promise<ActionResult> {
  if (!Array.isArray(input) || input.length === 0 || input.length > 50) return { ok: false, message: "Nothing to save." };

  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const c = await db.case.findFirst({ where: { id: caseId, ...scope }, select: { status: true, jobsheetNo: true } });
    if (!c) return { ok: false, message: "Case not found." };
    if (!BILLING_EDIT_STATUSES.includes(c.status)) return { ok: false, message: "Billed amounts can't be changed at this stage." };

    const labCase = await cameFromChipLab(caseId);
    const current = await db.caseItem.findMany({ where: { caseId, removedAt: null } });
    const byId = new Map(current.map((l) => [l.id, l]));

    const changes: { id: string; name: string; from: number; to: number; quantity: number }[] = [];
    for (const row of input) {
      const line = byId.get(row.id);
      if (!line) return { ok: false, message: "An item on this case has changed. Refresh and try again." };
      const parsed = optionalRupees("Billed amount").safeParse(row.unitPrice);
      if (!parsed.success || parsed.data === null || parsed.data <= 0) return { ok: false, message: `${line.name}: enter a billed amount.` };
      const unit = parsed.data;
      if (unit === line.unitPricePaise) continue;
      if (unit < line.minPricePaise) return { ok: false, message: `${line.name}: lowest allowed price is ${formatPaise(line.minPricePaise)}.` };
      if (labCase && line.type !== "SERVICE")
        return { ok: false, message: `${line.name}: only the service charge can be changed on a case from the chip-level lab.` };
      changes.push({ id: line.id, name: line.name, from: line.unitPricePaise, to: unit, quantity: line.quantity });
    }
    if (changes.length === 0) return { ok: true, message: "No changes to save." };

    const changed = new Map(changes.map((x) => [x.id, x]));
    const before = current.reduce((sum, l) => sum + l.lineTotalPaise, 0);
    const total = current.reduce((sum, l) => {
      const x = changed.get(l.id);
      return sum + (x ? x.to * x.quantity : l.lineTotalPaise);
    }, 0);

    const saved = await db.$transaction(async (tx) => {
      const { count } = await tx.case.updateMany({
        where: { id: caseId, status: c.status, ...scope },
        data: { estimatedCostPaise: total, updatedById: user.id },
      });
      if (count === 0) return false;
      for (const x of changes) {
        // Matches only while the line still has the price we read, so two people saving at once can't overwrite each other.
        const { count: n } = await tx.caseItem.updateMany({
          where: { id: x.id, removedAt: null, unitPricePaise: x.from },
          data: { unitPricePaise: x.to, lineTotalPaise: x.to * x.quantity },
        });
        if (n === 0) throw new StaleBill();
      }
      return true;
    }).catch((e) => {
      if (e instanceof StaleBill) return false;
      throw e;
    });
    if (!saved) return { ok: false, message: "Someone else changed this bill just now. Refresh to see the current amounts." };

    for (const x of changes)
      await logActivity({
        action: "case.billing",
        userId: user.id,
        entity: "Case",
        entityId: caseId,
        detail: `${x.name}: billed ${formatPaise(x.from)} → ${formatPaise(x.to)} per unit × ${x.quantity} (${c.jobsheetNo})`,
      });
    await logActivity({
      action: "case.estimate",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `Billed amounts updated (${changes.length} ${changes.length === 1 ? "item" : "items"}): bill total ${formatPaise(before)} → ${formatPaise(total)}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    return { ok: true, message: `Saved · bill total ${formatPaise(total)}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

class StaleBill extends Error {}
