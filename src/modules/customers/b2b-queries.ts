import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { customerWhere, type BranchScope } from "@/server/branch-scope";

// B2B accounts are customers of type BUSINESS. Cases for the company link to it
// through the case's "company account"; those are counted here.

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });
const who = { select: { firstName: true, lastName: true } } as const;

export const B2B_SORTS = ["createdAt", "code", "name", "phone", "lastVisitAt", "updatedAt"] as const;

const TAB_WHERE: Record<string, Prisma.CustomerWhereInput> = {
  "": { isActive: true },
  inactive: { isActive: false },
  all: {},
};

export async function listB2bAccounts(list: ListState, scope: BranchScope) {
  const digits = list.q.replace(/\D/g, "");
  const textSearch: Prisma.CustomerWhereInput = list.q
    ? {
        OR: [
          { name: contains(list.q) },
          { code: contains(list.q) },
          { gstin: contains(list.q) },
          { contactPerson: contains(list.q) },
          { email: contains(list.q) },
          ...(digits.length >= 3 ? [{ phone: { contains: digits } }, { altPhone: { contains: digits } }] : []),
        ],
      }
    : {};
  const search: Prisma.CustomerWhereInput = { AND: [customerWhere(scope), { type: "BUSINESS" }, textSearch] };
  const tab = TAB_WHERE[list.tab] ? list.tab : "";
  const where: Prisma.CustomerWhereInput = { AND: [search, TAB_WHERE[tab]!] };
  const orderBy: Prisma.CustomerOrderByWithRelationInput =
    list.sort === "lastVisitAt" ? { lastVisitAt: { sort: list.dir, nulls: "last" } } : { [list.sort]: list.dir };

  const count = (key: string) => db.customer.count({ where: { AND: [search, TAB_WHERE[key]!] } });
  const [rows, total, active, inactive, all] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: [orderBy, { createdAt: "desc" }],
      include: {
        updatedBy: who,
        branch: { select: { code: true, name: true } },
        _count: { select: { accountCases: true } },
      },
      ...pageArgs(list),
    }),
    db.customer.count({ where }),
    count(""),
    count("inactive"),
    count("all"),
  ]);
  const tabs: FilterTab[] = [
    { key: "", label: "Active", count: active },
    { key: "inactive", label: "Inactive", count: inactive },
    { key: "all", label: "All", count: all },
  ];
  return { rows, total, tabs };
}

/** One B2B account in the branch scope, or null. */
export const getB2bAccount = (id: string, scope: BranchScope) =>
  db.customer.findFirst({ where: { AND: [customerWhere(scope), { id, type: "BUSINESS" }] } });
