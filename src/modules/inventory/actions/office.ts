"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { toFieldErrors, pick, type FormState } from "@/lib/form";
import { postOfficeConsumption } from "@/modules/finance/posting";
import { requirePurchaseManager } from "../purchase-access";
import { officeConsumeSchema } from "../office-schema";
import { INVENTORY_PATHS } from "../paths";

/**
 * Hands an office-use unit (by USID) to an employee. Only an AVAILABLE office unit can be consumed, once: the unit becomes
 * Office Consumed with the employee, remarks and date, its USID history gets an entry, its cost moves from Inventory to
 * an expense in the ledger, and the activity log records the USID, employee, bill and warranty.
 */
export async function consumeOfficeUnit(unitId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = officeConsumeSchema.safeParse(pick(formData, ["employeeId", "remarks"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { employeeId, remarks } = parsed.data;

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.stock, "canEdit");
    requirePurchaseManager(user);

    const done = await db.$transaction(async (tx) => {
      const employee = await tx.user.findFirst({ where: { id: employeeId, isActive: true, status: "WORKING" }, select: { firstName: true, lastName: true } });
      if (!employee) throw new FieldError("employeeId", "Select an active employee");
      const unit = await tx.stockUnit.findUnique({
        where: { id: unitId },
        select: {
          usid: true,
          status: true,
          isOfficeUse: true,
          branchId: true,
          item: { select: { name: true } },
          warrantyLabel: true,
          warrantyEndsAt: true,
          billItem: { select: { taxablePaise: true, quantity: true, bill: { select: { billNo: true, code: true } } } },
        },
      });
      if (!unit || !unit.isOfficeUse) throw new FieldError("form", "This is not an office-use unit.");
      if (unit.status !== "AVAILABLE") throw new FieldError("form", `${unit.usid} has already been consumed.`);

      const now = new Date();
      const claimed = await tx.stockUnit.updateMany({
        where: { id: unitId, status: "AVAILABLE", isOfficeUse: true },
        data: { status: "OFFICE_CONSUMED", consumedAt: now, consumedById: user.id, officeEmployeeId: employeeId, officeRemarks: remarks },
      });
      if (claimed.count === 0) throw new FieldError("form", `${unit.usid} was just consumed by someone else.`);

      const who = [employee.firstName, employee.lastName].filter(Boolean).join(" ");
      await tx.stockUnitEvent.create({
        data: { unitId, action: "CONSUMED", userId: user.id, branchId: unit.branchId, note: `Office use — ${who}: ${remarks}` },
      });
      if (unit.billItem && unit.billItem.quantity > 0) {
        await postOfficeConsumption(
          tx,
          { unitId, usid: unit.usid, branchId: unit.branchId, costPaise: Math.round(unit.billItem.taxablePaise / unit.billItem.quantity), employee: who },
          user.id,
        );
      }
      return { usid: unit.usid, who, item: unit.item.name, bill: unit.billItem?.bill.billNo ?? null, warranty: unit.warrantyLabel, endsAt: unit.warrantyEndsAt };
    });

    await logActivity({
      action: "inventory.office-consume",
      userId: user.id,
      entity: "StockUnit",
      entityId: unitId,
      detail: [
        `${done.usid} (${done.item}) consumed for office use by ${done.who}: ${remarks}`,
        done.bill ? `bill ${done.bill}` : null,
        done.warranty ? `warranty ${done.warranty}${done.endsAt ? ` until ${done.endsAt.toISOString().slice(0, 10)}` : ""}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
    revalidatePath(INVENTORY_PATHS.stock);
    revalidatePath("/finance", "layout");
    return { ok: true, message: `${done.usid} handed to ${done.who}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    throw e;
  }
}
