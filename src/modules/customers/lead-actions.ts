"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { pick, toFieldErrors, type ActionResult, type FormState } from "@/lib/form";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { getBranchScope, leadWhere } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { CUSTOMER_PATHS } from "./paths";
import { LEAD_LABELS } from "./lead-schemas";
import { LEAD_FORM_FIELDS, leadFormSchema } from "@/modules/telecaller/lead-form-schema";
import { isTelecaller } from "@/server/rbac/roles";
import { changedFields, convertLeadRecord, createLeadRecord, describeChanges } from "./service";

type Scope = Awaited<ReturnType<typeof getBranchScope>>;

/** The phone is the dedupe key across leads and customers alike. */
async function phoneClash(phone: string, exceptId: string | null) {
  const clash = await db.customer.findFirst({
    where: { phone, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { code: true, name: true, kind: true },
  });
  if (!clash) return null;
  return clash.kind === "LEAD"
    ? `This number is already a lead: ${clash.name} (${clash.code})`
    : `This number belongs to customer ${clash.name} (${clash.code})`;
}

const getLeadInScope = (id: string, scope: Scope) =>
  db.customer.findFirst({
    where: { AND: [{ id, kind: "LEAD" }, leadWhere(scope)] },
    select: { code: true, isActive: true },
  });

export async function saveLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = leadFormSchema.safeParse(pick(formData, LEAD_FORM_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const { branchId: formBranch, serviceMode, appointmentAt, status, tokenNo, purchaseCost, margin, walkInDate, billingDate, salesPersonId, assignedTelecallerId, ...customerData } = parsed.data;
  const id = formData.get("id")?.toString() || null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.leads, id ? "canEdit" : "canCreate");
    const scope = await getBranchScope(actor);
    // Branch staff keep leads in their own branch and can't hand them to a telecaller; Head Office picks both.
    const bound = actor.privilege.isBranchBound;
    const clash = await phoneClash(customerData.phone, id);
    if (clash) throw new FieldError("phone", clash);

    if (!bound && formBranch) {
      const ok = await db.branch.findFirst({ where: { id: formBranch, isActive: true, isVirtual: false }, select: { id: true } });
      if (!ok) throw new FieldError("branchId", "Pick an active branch");
    }
    for (const [field, uid] of [["salesPersonId", salesPersonId], ["assignedTelecallerId", bound ? null : assignedTelecallerId]] as const) {
      if (!uid) continue;
      const u = await db.user.findFirst({ where: { id: uid, isActive: true, status: "WORKING" }, select: { id: true } });
      if (!u) throw new FieldError(field, "Pick an active staff member");
    }

    const tracking = {
      serviceMode,
      appointmentAt,
      tokenNo,
      purchaseCostPaise: purchaseCost,
      marginPaise: margin,
      walkInDate,
      billingDate,
      salesPersonId,
      ...(status ? { status } : {}),
      ...(bound ? {} : { assignedTelecallerId }),
    };

    if (id) {
      const existing = await db.customer.findFirst({ where: { AND: [{ id, leadCode: { not: null } }, leadWhere(scope)] } });
      if (!existing) throw new FieldError("name", "This lead no longer exists.");
      savedId = id;
      const open = existing.kind === "LEAD";
      const changed = open ? changedFields(existing, customerData) : [];
      const newBranch = bound ? undefined : formBranch;
      const branchChanged = newBranch !== undefined && newBranch !== existing.branchId;
      await db.$transaction(async (tx) => {
        if (open && (changed.length > 0 || branchChanged)) {
          await tx.customer.update({ where: { id }, data: { ...customerData, ...(branchChanged ? { branchId: newBranch } : {}), updatedById: actor.id } });
        } else if (!open && branchChanged) {
          await tx.customer.update({ where: { id }, data: { branchId: newBranch, updatedById: actor.id } });
        }
        await tx.leadProfile.upsert({
          where: { customerId: id },
          update: { ...tracking, ...(branchChanged && newBranch ? { assignedToBranchAt: new Date(), assignedToBranchById: actor.id } : {}) },
          create: { customerId: id, firstInteractionAt: existing.createdAt, ...tracking, status: status ?? (open ? "NEW" : "CONVERTED") },
        });
      });
      await logActivity({ action: "lead.update", userId: actor.id, entity: "Customer", entityId: id, detail: changed.length > 0 ? describeChanges(changed) : "Tracking details updated" });
      if (branchChanged && newBranch) {
        await logActivity({ action: "lead.assign-branch", userId: actor.id, entity: "Customer", entityId: id, detail: `${existing.leadCode} assigned to a branch` });
      }
    } else {
      const branchId = bound ? (scope.branchId ?? actor.branchId) : formBranch;
      const owner = isTelecaller(actor) ? actor.id : bound ? null : assignedTelecallerId;
      const lead = await db.$transaction(async (tx) => {
        const created = await createLeadRecord(tx, customerData, { branchId, actorId: actor.id, telecallerId: owner });
        await tx.leadProfile.update({
          where: { customerId: created.id },
          data: { ...tracking, assignedTelecallerId: owner, ...(!bound && branchId ? { assignedToBranchAt: new Date(), assignedToBranchById: actor.id } : {}) },
        });
        return created;
      });
      savedId = lead.id;
      await logActivity({ action: "lead.create", userId: actor.id, entity: "Customer", entityId: lead.id, detail: lead.code });
    }
  } catch (e) {
    return handleActionError(e, LEAD_LABELS, formData);
  }

  revalidatePath(CUSTOMER_PATHS.leads, "layout");
  redirect(`${CUSTOMER_PATHS.leads}?saved=${Date.now()}&highlight=${savedId}`);
}

/** Converts a lead into a customer on the same record (no duplicate is created). */
export async function convertLead(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.leads, "canEdit");
    const scope = await getBranchScope(actor);
    const lead = await getLeadInScope(id, scope);
    if (!lead) return { ok: false, message: "This lead was already converted or no longer exists." };
    if (!lead.isActive) return { ok: false, message: "Reopen this lead before converting it." };

    const customer = await db.$transaction((tx) =>
      convertLeadRecord(tx, id, actor.id, scope.branchId ?? actor.branchId),
    );
    if (!customer) return { ok: false, message: "This lead was already converted." };

    await logActivity({
      action: "lead.convert",
      userId: actor.id,
      entity: "Customer",
      entityId: id,
      detail: `${lead.code} → ${customer.code}`,
    });
    revalidatePath(CUSTOMER_PATHS.leads, "layout");
    revalidatePath(CUSTOMER_PATHS.database, "layout");
    revalidatePath(CUSTOMER_PATHS.leadReports, "layout");
    return { ok: true, message: `Converted to customer ${customer.code}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Soft delete — sets `isDelete = 1`; the lead stays in the database. */
export async function deleteLead(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.leads, "canEdit");
    const row = await getLeadInScope(id, await getBranchScope(actor));
    if (!row) return { ok: false, message: "Lead not found." };
    await db.customer.update({ where: { id }, data: { isDelete: 1, updatedById: actor.id } });
    await logActivity({ action: "lead.delete", userId: actor.id, entity: "Customer", entityId: id });
    revalidatePath(CUSTOMER_PATHS.leads, "layout");
    revalidatePath(CUSTOMER_PATHS.leadReports, "layout");
    return { ok: true, message: "Lead deleted." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Same as convertLead, shaped for a confirmation dialog. */
export async function convertLeadWithConfirm(id: string, _prev: FormState, _formData: FormData): Promise<FormState> {
  const result = await convertLead(id);
  return { ok: result.ok, message: result.message };
}
