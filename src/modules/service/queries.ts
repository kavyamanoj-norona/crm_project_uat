import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { BranchScope } from "@/server/branch-scope";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { listBusinessAccounts } from "@/modules/customers/queries";
import { CASE_STATUSES, CASE_STATUS_LABELS } from "./case-schema";
import { peekJobsheetNo } from "./jobsheet";
import type { TatLimits } from "./case-age";
import { RULES, getBooleanRule, getNumberRule } from "@/server/rules";
import { minPricePaise } from "@/lib/pricing";

// Every query here is branch-scoped: pass `branchWhere(await getBranchScope(user))`.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const who = { select: { firstName: true, lastName: true } } as const;

// ─── Intake ──────────────────────────────────────────────────────────────────

/**
 * Everything the New Case form needs. Branches are the counters in scope
 * (virtual branches such as the lab take no walk-ins).
 */
export async function intakeOptions(scope: BranchScope) {
  const branches = await db.branch.findMany({
    where: { isActive: true, isVirtual: false, ...(scope.branchId ? { id: scope.branchId } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true },
  });
  const [accounts, previews] = await Promise.all([
    listBusinessAccounts(),
    Promise.all(branches.map(async (b) => [b.id, await peekJobsheetNo(b.code)] as const)),
  ]);
  return {
    branches,
    accounts: accounts.map((a) => ({ id: a.id, label: a.name })),
    previews: Object.fromEntries(previews) as Record<string, string>,
  };
}

// ─── Cases ───────────────────────────────────────────────────────────────────

export const CASE_SORTS = ["createdAt", "jobsheetNo", "status", "stageChangedAt", "estimatedCostPaise"] as const;
export const UNCOLLECTED_SORTS = ["stageChangedAt", "jobsheetNo", "estimatedCostPaise"] as const;

/** "Type" filter on the Cases list → warranty status. */
export const CASE_TYPE_FILTERS = {
  paid: { label: "Paid repair", where: { warrantyStatus: "NON_WARRANTY" } },
  warranty: { label: "Warranty repair", where: { warrantyStatus: "WARRANTY" } },
  rework: { label: "Warranty rework", where: { warrantyStatus: "RETURN" } },
} as const satisfies Record<string, { label: string; where: Prisma.CaseWhereInput }>;

export type CaseTypeFilter = keyof typeof CASE_TYPE_FILTERS;

export const isCaseTypeFilter = (v: string | undefined): v is CaseTypeFilter => !!v && v in CASE_TYPE_FILTERS;

/** All ready-for-delivery cases; those past the uncollected threshold are highlighted. */
export async function listUncollectedCases(list: ListState, scope: { branchId?: string }) {
  const days = await getNumberRule(RULES.uncollectedAfterDays, 15);
  const digits = list.q.replace(/\D/g, "");
  const where: Prisma.CaseWhereInput = {
    ...scope,
    status: "READY_FOR_DELIVERY",
    ...(list.q
      ? {
          OR: [
            { jobsheetNo: contains(list.q) },
            { brand: contains(list.q) },
            { model: contains(list.q) },
            { customer: { name: contains(list.q) } },
            ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
          ],
        }
      : {}),
  };
  const orderBy: Prisma.CaseOrderByWithRelationInput =
    list.sort === "estimatedCostPaise"
      ? { estimatedCostPaise: { sort: list.dir, nulls: "last" } }
      : { [list.sort]: list.dir };

  const [rows, total] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: [orderBy, { stageChangedAt: "asc" }],
      select: {
        id: true,
        jobsheetNo: true,
        brand: true,
        model: true,
        stageChangedAt: true,
        estimatedCostPaise: true,
        customer: { select: { name: true, phone: true } },
        payments: { select: { amountPaise: true } },
        whatsappMessages: {
          where: { templateName: "pickup_reminder" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { status: true, sentAt: true, createdAt: true },
        },
      },
      ...pageArgs(list),
    }),
    db.case.count({ where }),
  ]);

  return { rows, total, days };
}

/** Tabs are the case stages; `type` narrows by warranty status. */
export async function listCases(list: ListState, scope: { branchId?: string }, type?: CaseTypeFilter) {
  const digits = list.q.replace(/\D/g, "");
  const search: Prisma.CaseWhereInput = {
    ...scope,
    ...(type ? CASE_TYPE_FILTERS[type].where : {}),
    ...(list.q
      ? {
          OR: [
            { jobsheetNo: contains(list.q) },
            { serialNo: contains(list.q) },
            { brand: contains(list.q) },
            { model: contains(list.q) },
            { customer: { name: contains(list.q) } },
            ...(digits.length >= 3 ? [{ customer: { phone: { contains: digits } } }] : []),
          ],
        }
      : {}),
  };
  const status = (CASE_STATUSES as readonly string[]).includes(list.tab) ? (list.tab as (typeof CASE_STATUSES)[number]) : null;
  const where = { ...search, ...(status ? { status } : {}) };
  const orderBy: Prisma.CaseOrderByWithRelationInput =
    list.sort === "estimatedCostPaise"
      ? { [list.sort]: { sort: list.dir, nulls: "last" } }
      : { [list.sort]: list.dir };

  const [rows, total, all, byStatus] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      include: {
        customer: { select: { id: true, name: true, phone: true, type: true } },
        engineer: who,
        createdBy: who,
        branch: { select: { code: true } },
        payments: { select: { amountPaise: true } },
      },
      ...pageArgs(list),
    }),
    db.case.count({ where }),
    db.case.count({ where: search }),
    db.case.groupBy({ by: ["status"], where: search, _count: { _all: true } }),
  ]);
  const counts = new Map(byStatus.map((s) => [s.status, s._count._all]));
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    ...CASE_STATUSES.map((s) => ({ key: s, label: CASE_STATUS_LABELS[s], count: counts.get(s) ?? 0 })),
  ];
  return { rows, total, tabs };
}

/** One case with everything the details page shows; null when missing or outside the branch scope. */
export const getCase = (id: string, scope: { branchId?: string }) =>
  db.case.findFirst({
    where: { id, ...scope },
    include: {
      branch: { select: { code: true, name: true } },
      customer: { select: { id: true, code: true, name: true, phone: true, email: true, altPhone: true, type: true, visitCount: true } },
      account: { select: { id: true, name: true } },
      engineer: who,
      createdBy: who,
      updatedBy: who,
      items: { where: { removedAt: null }, orderBy: { sortOrder: "asc" } },
      receivedItems: { orderBy: { sortOrder: "asc" } },
      attachments: { orderBy: { createdAt: "asc" }, include: { createdBy: who } },
      statusHistory: { orderBy: { at: "desc" }, include: { changedBy: who } },
      payments: { orderBy: { createdAt: "asc" }, include: { receivedBy: who } },
      feedback: { include: { createdBy: who } },
    },
  });

export type CaseDetails = NonNullable<Awaited<ReturnType<typeof getCase>>>;

/** Hours allowed per stage, from Master Settings → Rules. */
export async function getTatLimits(): Promise<TatLimits> {
  const [diagnosis, approval, repair, uncollectedDays] = await Promise.all([
    getNumberRule(RULES.tatDiagnosisHours, 24),
    getNumberRule(RULES.tatApprovalFollowupHours, 12),
    getNumberRule(RULES.tatRepairHours, 72),
    getNumberRule(RULES.uncollectedAfterDays, 15),
  ]);
  return {
    INTAKE: diagnosis,
    DIAGNOSIS: diagnosis,
    PENDING_APPROVAL: approval,
    AWAITING_STOCK: repair,
    QUALITY_CHECK: repair,
    READY_FOR_DELIVERY: uncollectedDays * 24,
  };
}

/** Details-page extras: the customer's paid total (branch scope) and the GST rule. */
export async function getCaseExtras(customerId: string, scope: { branchId?: string }) {
  const [paid, gstPercent, gstInclusive] = await Promise.all([
    db.payment.aggregate({ where: { ...scope, customerId }, _sum: { amountPaise: true } }),
    getNumberRule(RULES.defaultGstPercent, 18),
    getBooleanRule(RULES.gstInclusive, true),
  ]);
  return { lifetimePaise: paid._sum.amountPaise ?? 0, gstPercent, gstInclusive };
}

// ─── Estimate dialog ─────────────────────────────────────────────────────────

/** Active catalog items for the estimate picker, with their minimum selling price. */
export async function listCatalogForPicker() {
  const items = await db.item.findMany({
    where: { isActive: true },
    orderBy: [{ name: "asc" }],
    take: 2000,
    select: { id: true, code: true, name: true, type: true, category: true, brand: true, unit: true, pricePaise: true, maxDiscountPercent: true, gstPercent: true },
  });
  return items.map((i) => ({ ...i, minPricePaise: minPricePaise(i.pricePaise, i.maxDiscountPercent) }));
}
export type CatalogItem = Awaited<ReturnType<typeof listCatalogForPicker>>[number];

/** Working staff of a branch, for "Assign engineer". */
export async function listBranchStaff(branchId: string) {
  const users = await db.user.findMany({
    where: { isActive: true, status: "WORKING", branchId },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, department: { select: { name: true } } },
  });
  return users.map((u) => ({ value: u.id, label: `${[u.firstName, u.lastName].filter(Boolean).join(" ")} · ${u.department.name}` }));
}
