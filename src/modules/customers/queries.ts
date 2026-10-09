import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { customerWhere, type BranchScope } from "@/server/branch-scope";
import { VISIT_FILTERS } from "./schemas";

// One customer record per phone number. Branch users only see their branch's
// customers (see customerWhere); all-branch users see everyone.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

const who = { select: { firstName: true, lastName: true } } as const;

export const CUSTOMER_SORTS = ["createdAt", "code", "name", "phone", "visitCount", "lastVisitAt", "updatedAt"] as const;

const TAB_WHERE: Record<string, Prisma.CustomerWhereInput> = {
  individual: { type: "INDIVIDUAL", isActive: true },
  business: { type: "BUSINESS", isActive: true },
  inactive: { isActive: false },
};

export async function listCustomers(list: ListState, scope: BranchScope) {
  const digits = list.q.replace(/\D/g, "");
  const textSearch: Prisma.CustomerWhereInput = list.q
    ? {
        OR: [
          { name: contains(list.q) },
          { email: contains(list.q) },
          { code: contains(list.q) },
          { gstin: contains(list.q) },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }, { altPhone: { contains: digits } }] : []),
        ],
      }
    : {};
  const minVisits = VISIT_FILTERS.find((f) => f.value === (list.query[list.prefix + "visits"] ?? ""))?.min ?? 0;
  const visitFilter: Prisma.CustomerWhereInput = minVisits > 0 ? { visitCount: { gte: minVisits } } : {};
  const search: Prisma.CustomerWhereInput = { AND: [customerWhere(scope), textSearch, visitFilter] };
  const where: Prisma.CustomerWhereInput = { AND: [search, TAB_WHERE[list.tab] ?? {}] };
  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    list.sort === "lastVisitAt" ? { lastVisitAt: { sort: list.dir, nulls: "last" } } : { [list.sort]: list.dir };

  const [rows, total, all, individual, business, inactive] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      include: { createdBy: who, updatedBy: who, branch: { select: { code: true, name: true } } },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    db.customer.count({ where: search }),
    ...(["individual", "business", "inactive"] as const).map((k) => db.customer.count({ where: { AND: [search, TAB_WHERE[k]!] } })),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "individual", label: "Individual", count: individual },
    { key: "business", label: "Business (B2B)", count: business },
    { key: "inactive", label: "Inactive", count: inactive },
  ];
  return { rows, total, tabs };
}

/** One customer, or null when it isn't in the branch scope (a 404 for branch users). */
export const getCustomer = (id: string, scope: BranchScope) =>
  db.customer.findFirst({
    where: { id, ...customerWhere(scope) },
    include: { createdBy: who, updatedBy: who, branch: { select: { code: true, name: true } } },
  });

/** The customer's latest cases in the branch scope. */
export const listCustomerCases = (customerId: string, scope: { branchId?: string }) =>
  db.case.findMany({
    where: { ...scope, OR: [{ customerId }, { accountId: customerId }] },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      jobsheetNo: true,
      status: true,
      productType: true,
      brand: true,
      model: true,
      estimatedCostPaise: true,
      createdAt: true,
      branch: { select: { code: true } },
    },
  });

export const HISTORY_SORTS = ["at"] as const;

/** Activity log rows about one record (created, edited, activated …). */
export async function listRecordHistory(list: ListState, entityId: string) {
  const where = { entityId };
  const [rows, total] = await Promise.all([
    db.userActivityLog.findMany({
      where,
      orderBy: { at: list.dir },
      include: { user: { select: { firstName: true, lastName: true, userCode: true } } },
      ...pageArgs(list),
    }),
    db.userActivityLog.count({ where }),
  ]);
  return { rows, total };
}

/** Active B2B accounts for the "Company account" picker. */
export const listBusinessAccounts = () =>
  db.customer.findMany({
    where: { kind: "CUSTOMER", type: "BUSINESS", isActive: true },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, phone: true },
  });

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getCustomerDashboardStats(scope: BranchScope) {
  const cw = customerWhere(scope);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [total, newThisMonth, business, atRisk, repeatLast30, bySource, topByVisits, recentCustomers] =
    await Promise.all([
      db.customer.count({ where: { ...cw, isActive: true } }),
      db.customer.count({ where: { ...cw, createdAt: { gte: startOfMonth }, isActive: true } }),
      db.customer.count({ where: { ...cw, type: "BUSINESS", isActive: true } }),
      db.customer.count({ where: { ...cw, isActive: true, lastVisitAt: { lt: ninetyDaysAgo, not: null } } }),
      db.customer.count({ where: { ...cw, isActive: true, lastVisitAt: { gte: thirtyDaysAgo }, visitCount: { gt: 1 } } }),
      db.customer.groupBy({
        by: ["source"],
        where: { ...cw, isActive: true, source: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      db.customer.findMany({
        where: { ...cw, isActive: true, visitCount: { gt: 1 } },
        orderBy: { visitCount: "desc" },
        take: 8,
        select: { id: true, code: true, name: true, phone: true, visitCount: true, lastVisitAt: true, type: true },
      }),
      db.customer.findMany({
        where: cw,
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, code: true, name: true, phone: true, type: true, source: true, createdAt: true },
      }),
    ]);

  return { total, newThisMonth, business, atRisk, repeatLast30, bySource, topByVisits, recentCustomers };
}

// ─── CS Workspace ─────────────────────────────────────────────────────────────

const caseWorkspaceSelect = {
  id: true,
  jobsheetNo: true,
  status: true,
  productType: true,
  brand: true,
  model: true,
  estimatedCostPaise: true,
  stageChangedAt: true,
  updatedAt: true,
  branch: { select: { code: true, name: true } },
  customer: { select: { id: true, name: true, phone: true } },
} satisfies Prisma.CaseSelect;

export async function getCsWorkspaceData(scope: { branchId?: string }) {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

  const [feedbackPending, readyForDelivery, lapseRisk] = await Promise.all([
    db.case.findMany({
      where: { ...scope, status: "CLOSED", feedback: null },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: caseWorkspaceSelect,
    }),
    db.case.findMany({
      where: { ...scope, status: "READY_FOR_DELIVERY", stageChangedAt: { lt: twentyFourHoursAgo } },
      orderBy: { stageChangedAt: "asc" },
      take: 20,
      select: caseWorkspaceSelect,
    }),
    db.customer.findMany({
      where: { ...customerWhere({ branchId: scope.branchId ?? null }), isActive: true, lastVisitAt: { lt: sixtyDaysAgo, not: null } },
      orderBy: { lastVisitAt: "asc" },
      take: 20,
      select: { id: true, code: true, name: true, phone: true, lastVisitAt: true, visitCount: true },
    }),
  ]);

  return { feedbackPending, readyForDelivery, lapseRisk };
}
