"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { getBranchScope, branchWhere, leadWhere } from "@/server/branch-scope";
import { FieldError, handleActionError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { isTelecaller } from "@/server/rbac/roles";
import { CUSTOMER_PATHS } from "@/modules/customers/paths";
import { convertLeadRecord } from "@/modules/customers/service";
import { TELECALLER_PATHS } from "./paths";
import {
  CALL_FIELDS,
  INCENTIVE_RULE_FIELDS,
  SERVICE_PRICE_FIELDS,
  TARGET_FIELDS,
  callSchema,
  incentiveRuleSchema,
  servicePriceSchema,
  targetSchema,
} from "./schemas";
import { telecallerOwnWhere } from "./queries";
import { addLeadCall } from "./service";
import { CALL_OUTCOME_LABELS, type CallOutcomeValue } from "./status";

const MAX_BULK = 200;

function refresh() {
  revalidatePath("/telecaller", "layout");
  revalidatePath("/customers", "layout");
}

const rupeesToPaise = (v: string) => {
  const t = v.replace(/[,\s₹]/g, "");
  const [whole = "0", frac = ""] = t.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
};

// ─── Calls ───────────────────────────────────────────────────────────────────

/**
 * A Head Office telecaller records a call on a lead: outcome, remarks, next follow-up. The call is appended to the lead's
 * history and its summary (status, next follow-up) is updated. Branch staff use recordBranchCall instead.
 */
export async function recordTelecallerCall(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = callSchema.safeParse(pick(formData, CALL_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(CUSTOMER_PATHS.leads, "canEdit");
    if (user.privilege.isBranchBound) throw new FieldError("form", "Branch staff record calls from the Branch Call List.");
    const scope = await getBranchScope(user);
    const lead = await db.customer.findFirst({
      where: { AND: [{ id: customerId, leadCode: { not: null } }, leadWhere(scope), ...(isTelecaller(user) ? [telecallerOwnWhere(user.id)] : [])] },
      select: { id: true, leadCode: true },
    });
    if (!lead) return { message: "Lead not found." };
    const { outcome, remarks, nextFollowUpAt, status } = parsed.data;
    if (nextFollowUpAt && nextFollowUpAt.getTime() < Date.now() - 60_000) return { message: "Fix the highlighted fields.", fieldErrors: { nextFollowUpAt: ["Pick a follow-up time in the future"] } };
    const r = await db.$transaction((tx) => addLeadCall(tx, { customerId, side: "TELECALLER", outcome, remarks, nextFollowUpAt, byId: user.id, branchId: null, status }));
    await logActivity({
      action: "lead.call",
      userId: user.id,
      entity: "Customer",
      entityId: customerId,
      detail: `${lead.leadCode}: ${CALL_OUTCOME_LABELS[outcome]}${remarks ? ` — ${remarks.slice(0, 120)}` : ""}${r.from !== r.to ? ` (${r.from} → ${r.to})` : ""}`,
    });
    refresh();
    return { ok: true, message: "Call recorded." };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

/**
 * Branch staff update the outcome of a lead Head Office assigned to their branch. This adds a branch call to the history; the
 * telecaller's own calls and remarks are never touched.
 */
export async function recordBranchCall(customerId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = callSchema.safeParse(pick(formData, CALL_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.branchCalls, "canEdit");
    if (!user.privilege.isBranchBound && !user.privilege.isSuperAdmin) throw new ForbiddenError();
    const scope = await getBranchScope(user);
    const lead = await db.customer.findFirst({
      where: { id: customerId, leadCode: { not: null }, ...branchWhere(scope), leadProfile: { assignedToBranchAt: { not: null } } },
      select: { id: true, leadCode: true, branchId: true },
    });
    if (!lead) return { message: "Lead not found." };
    const { outcome, remarks, nextFollowUpAt, status } = parsed.data;
    if (nextFollowUpAt && nextFollowUpAt.getTime() < Date.now() - 60_000) return { message: "Fix the highlighted fields.", fieldErrors: { nextFollowUpAt: ["Pick a follow-up time in the future"] } };
    const r = await db.$transaction((tx) => addLeadCall(tx, { customerId, side: "BRANCH", outcome, remarks, nextFollowUpAt, byId: user.id, branchId: lead.branchId, status }));
    await logActivity({
      action: "lead.branch-call",
      userId: user.id,
      entity: "Customer",
      entityId: customerId,
      detail: `${lead.leadCode}: ${CALL_OUTCOME_LABELS[outcome as CallOutcomeValue]}${remarks ? ` — ${remarks.slice(0, 120)}` : ""}${r.from !== r.to ? ` (${r.from} → ${r.to})` : ""}`,
    });
    refresh();
    return { ok: true, message: "Update saved." };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

// ─── Bulk conversion ─────────────────────────────────────────────────────────

/**
 * Converts the selected open leads to customers of one branch. Each lead is converted in place (same record, same history)
 * by the same routine as a single conversion, then handed to the branch's call list. Leads that were already converted are
 * skipped, never duplicated.
 */
export async function bulkConvertLeads(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await requireActionPermission(CUSTOMER_PATHS.leads, "canEdit");
    if (user.privilege.isBranchBound) throw new ForbiddenError();
    const ids = [...new Set(formData.getAll("ids").map(String).filter(Boolean))];
    const branchId = String(formData.get("branchId") ?? "");
    if (ids.length === 0) return { message: "Select at least one lead." };
    if (ids.length > MAX_BULK) return { message: `Convert up to ${MAX_BULK} leads at a time.` };
    if (!branchId) return { message: "Select the branch.", fieldErrors: { branchId: ["Select the branch"] } };
    const branch = await db.branch.findFirst({ where: { id: branchId, isActive: true, isVirtual: false }, select: { id: true, code: true, name: true } });
    if (!branch) return { message: "Pick an active branch.", fieldErrors: { branchId: ["Pick an active branch"] } };

    const scope = await getBranchScope(user);
    const leads = await db.customer.findMany({
      where: { AND: [{ id: { in: ids }, kind: "LEAD", isActive: true, leadCode: { not: null } }, leadWhere(scope)] },
      select: { id: true, leadCode: true },
    });

    const done: { leadCode: string; code: string }[] = [];
    await db.$transaction(async (tx) => {
      for (const l of leads) {
        const c = await convertLeadRecord(tx, l.id, user.id, branch.id);
        if (!c) continue;
        // Bulk conversion is an assignment: the chosen branch wins over any earlier one.
        await tx.customer.update({ where: { id: l.id }, data: { branchId: branch.id } });
        await tx.leadProfile.updateMany({
          where: { customerId: l.id },
          data: { assignedToBranchAt: new Date(), assignedToBranchById: user.id },
        });
        await tx.leadProfile.updateMany({ where: { customerId: l.id, assignedTelecallerId: null }, data: { assignedTelecallerId: user.id } });
        done.push({ leadCode: l.leadCode!, code: c.code });
      }
    });
    for (const d of done) {
      await logActivity({ action: "lead.convert", userId: user.id, entity: "Customer", entityId: leads.find((l) => l.leadCode === d.leadCode)!.id, detail: `${d.leadCode} → ${d.code} (bulk, ${branch.name})` });
    }
    refresh();
    const skipped = ids.length - done.length;
    return {
      ok: done.length > 0,
      message: done.length === 0 ? "None of the selected leads could be converted (already converted or not open)." : `Converted ${done.length} ${done.length === 1 ? "lead" : "leads"} to ${branch.name}${skipped ? `; ${skipped} skipped (already converted or not open)` : ""}.`,
    };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    throw e;
  }
}

// ─── Service price estimates ─────────────────────────────────────────────────

/** Adds (id null) or edits an estimated price for a reported issue / repair type. */
export async function saveServicePrice(id: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = servicePriceSchema.safeParse(pick(formData, SERVICE_PRICE_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.servicePrices, id ? "canEdit" : "canCreate");
    const { name, productType, min, max, notes } = parsed.data;
    const dup = await db.servicePriceEstimate.findFirst({
      where: { name: { equals: name, mode: "insensitive" }, productType, ...(id ? { NOT: { id } } : {}) },
      select: { id: true },
    });
    if (dup) return { message: "Fix the highlighted fields.", fieldErrors: { name: ["An estimate for this issue and product already exists"] } };
    const data = { name, productType, minPaise: min, maxPaise: max, notes };
    const row = id
      ? await db.servicePriceEstimate.update({ where: { id }, data, select: { id: true } })
      : await db.servicePriceEstimate.create({ data: { ...data, createdById: user.id }, select: { id: true } });
    await logActivity({ action: id ? "telecaller.price.update" : "telecaller.price.create", userId: user.id, entity: "ServicePriceEstimate", entityId: row.id, detail: `${name}: ${formatPaise(min)} – ${formatPaise(max)}` });
    refresh();
    return { ok: true, message: "Estimate saved." };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

/** Switches an estimate off (or back on); nothing is deleted. */
export async function toggleServicePrice(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.servicePrices, "canEdit");
    const row = await db.servicePriceEstimate.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!row) return { ok: false, message: "Estimate not found." };
    await db.servicePriceEstimate.update({ where: { id }, data: { isActive: !row.isActive } });
    await logActivity({ action: "telecaller.price.toggle", userId: user.id, entity: "ServicePriceEstimate", entityId: id, detail: `${row.name}: ${row.isActive ? "switched off" : "switched on"}` });
    refresh();
    return { ok: true, message: row.isActive ? "Estimate switched off." : "Estimate switched on." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

// ─── Incentive rules and monthly targets ─────────────────────────────────────

/** Adds an incentive rule. Rules apply from their start date; to change one, switch it off and add another. */
export async function saveIncentiveRule(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = incentiveRuleSchema.safeParse(pick(formData, INCENTIVE_RULE_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.incentives, "canCreate");
    const v = parsed.data;
    const margin = v.basis === "MARGIN_PERCENT";
    const row = await db.incentiveRule.create({
      data: {
        name: v.name,
        basis: v.basis,
        amountPaise: margin ? null : rupeesToPaise(v.amount),
        percentBp: margin ? Math.round(Number(v.percent) * 100) : null,
        minMarginPaise: margin && v.minMargin !== "" ? rupeesToPaise(v.minMargin) : null,
        effectiveFrom: new Date(`${v.effectiveFrom}T00:00:00Z`),
      },
      select: { id: true },
    });
    await logActivity({ action: "telecaller.incentive-rule.create", userId: user.id, entity: "IncentiveRule", entityId: row.id, detail: `${v.name} (${v.basis}) from ${v.effectiveFrom}` });
    refresh();
    return { ok: true, message: "Rule added." };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}

export async function toggleIncentiveRule(id: string): Promise<{ ok: boolean; message: string }> {
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.incentives, "canEdit");
    const row = await db.incentiveRule.findUnique({ where: { id }, select: { isActive: true, name: true } });
    if (!row) return { ok: false, message: "Rule not found." };
    await db.incentiveRule.update({ where: { id }, data: { isActive: !row.isActive } });
    await logActivity({ action: "telecaller.incentive-rule.toggle", userId: user.id, entity: "IncentiveRule", entityId: id, detail: `${row.name}: ${row.isActive ? "switched off" : "switched on"}` });
    refresh();
    return { ok: true, message: row.isActive ? "Rule switched off." : "Rule switched on." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Sets (or replaces) a telecaller's targets for a month. */
export async function saveTelecallerTarget(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = targetSchema.safeParse(pick(formData, TARGET_FIELDS));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);
  try {
    const user = await requireActionPermission(TELECALLER_PATHS.incentives, "canEdit");
    const { userId, month, conversionsTarget, billingsTarget } = parsed.data;
    const target = await db.user.findFirst({ where: { id: userId, isActive: true, privilege: { code: "TELECALLER" } }, select: { firstName: true, lastName: true } });
    if (!target) return { message: "Fix the highlighted fields.", fieldErrors: { userId: ["Pick an active telecaller"] } };
    await db.telecallerTarget.upsert({
      where: { userId_month: { userId, month } },
      update: { conversionsTarget, billingsTarget },
      create: { userId, month, conversionsTarget, billingsTarget },
    });
    await logActivity({ action: "telecaller.target.set", userId: user.id, entity: "TelecallerTarget", entityId: userId, detail: `${month}: ${conversionsTarget} conversions, ${billingsTarget} billings` });
    refresh();
    return { ok: true, message: "Target saved." };
  } catch (e) {
    return handleActionError(e, {}, formData);
  }
}
