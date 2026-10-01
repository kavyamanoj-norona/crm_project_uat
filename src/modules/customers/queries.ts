import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

// Customers are shared by all branches (the phone is the dedupe key), so these
// queries are not branch-scoped. Their cases are.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

const who = { select: { firstName: true, lastName: true } } as const;

export const CUSTOMER_SORTS = ["createdAt", "code", "name", "phone", "visitCount", "lastVisitAt", "updatedAt"] as const;

const TAB_WHERE: Record<string, Prisma.CustomerWhereInput> = {
  individual: { type: "INDIVIDUAL", isActive: true },
  business: { type: "BUSINESS", isActive: true },
  inactive: { isActive: false },
};

export async function listCustomers(list: ListState) {
  const digits = list.q.replace(/\D/g, "");
  const search: Prisma.CustomerWhereInput = list.q
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
  const where = { ...search, ...(TAB_WHERE[list.tab] ?? {}) };
  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    list.sort === "lastVisitAt" ? { lastVisitAt: { sort: list.dir, nulls: "last" } } : { [list.sort]: list.dir };

  const [rows, total, all, individual, business, inactive] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      include: { createdBy: who, updatedBy: who },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    db.customer.count({ where: search }),
    ...(["individual", "business", "inactive"] as const).map((k) => db.customer.count({ where: { ...search, ...TAB_WHERE[k] } })),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "individual", label: "Individual", count: individual },
    { key: "business", label: "Business (B2B)", count: business },
    { key: "inactive", label: "Inactive", count: inactive },
  ];
  return { rows, total, tabs };
}

export const getCustomer = (id: string) =>
  db.customer.findUnique({ where: { id }, include: { createdBy: who, updatedBy: who } });

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
    where: { type: "BUSINESS", isActive: true },
    orderBy: { name: "asc" },
    take: 500,
    select: { id: true, name: true, phone: true },
  });
