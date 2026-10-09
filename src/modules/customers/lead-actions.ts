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
import { LEAD_FIELDS, LEAD_LABELS, leadSchema } from "./lead-schemas";
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
  const parsed = leadSchema.safeParse(pick(formData, LEAD_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  const data = parsed.data;
  const id = formData.get("id")?.toString() || null;

  let savedId: string;
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.leads, id ? "canEdit" : "canCreate");
    const scope = await getBranchScope(actor);
    const clash = await phoneClash(data.phone, id);
    if (clash) throw new FieldError("phone", clash);

    if (id) {
      const existing = await db.customer.findFirst({ where: { AND: [{ id, kind: "LEAD" }, leadWhere(scope)] } });
      if (!existing) throw new FieldError("name", "This lead no longer exists or was already converted.");
      const changed = changedFields(existing, data);
      savedId = id;
      if (changed.length > 0) {
        await db.customer.update({ where: { id }, data: { ...data, updatedById: actor.id } });
        await logActivity({
          action: "lead.update",
          userId: actor.id,
          entity: "Customer",
          entityId: id,
          detail: describeChanges(changed),
        });
      }
    } else {
      const lead = await db.$transaction((tx) =>
        createLeadRecord(tx, data, { branchId: scope.branchId, actorId: actor.id }),
      );
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

/** Leads are never deleted — they are closed (and can be reopened). */
export async function toggleLeadActive(id: string): Promise<ActionResult> {
  try {
    const actor = await requireActionPermission(CUSTOMER_PATHS.leads, "canEdit");
    const row = await getLeadInScope(id, await getBranchScope(actor));
    if (!row) return { ok: false, message: "Lead not found." };
    await db.customer.update({ where: { id }, data: { isActive: !row.isActive, updatedById: actor.id } });
    await logActivity({
      action: `lead.${row.isActive ? "close" : "reopen"}`,
      userId: actor.id,
      entity: "Customer",
      entityId: id,
    });
    revalidatePath(CUSTOMER_PATHS.leads, "layout");
    revalidatePath(CUSTOMER_PATHS.leadReports, "layout");
    return { ok: true, message: row.isActive ? "Lead closed." : "Lead reopened." };
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
