import "server-only";
import { db } from "@/server/db";
import { getHeadOfficeBranch } from "./head-office";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";

export async function listStock(branchId: string | null) {
  return db.stockItem.findMany({
    where: branchId ? { branchId } : {},
    include: {
      item: {
        select: { id: true, code: true, name: true, type: true, pricePaise: true, maxDiscountPercent: true },
      },
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: { item: { name: "asc" } },
  });
}

export async function listPurchaseRequests(branchId: string | null) {
  return db.purchaseRequest.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status: { notIn: ["FULFILLED", "REJECTED"] },
    },
    include: {
      item: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      case: { select: { id: true, jobsheetNo: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
}

export async function listTransfers(branchId: string | null) {
  return db.stockTransfer.findMany({
    where: {
      ...(branchId ? { OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] } : {}),
      status: { not: "CANCELLED" },
    },
    include: {
      fromBranch: { select: { id: true, code: true, name: true } },
      toBranch: { select: { id: true, code: true, name: true } },
      items: {
        include: { item: { select: { id: true, code: true, name: true } } },
      },
      createdBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

export async function listPhysicalItems() {
  return db.item.findMany({
    where: { isActive: true, type: { in: ["PART", "ACCESSORY"] } },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

export async function listAllActiveItems() {
  return db.item.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { name: "asc" },
  });
}

export async function listActivePurchaseRequests(branchId: string | null) {
  return db.purchaseRequest.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status: { not: "FULFILLED" },
    },
    include: {
      item: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      case: { select: { id: true, jobsheetNo: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
      attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
      stockUnits: {
        select: { id: true, usid: true, status: true, receivedAt: true, item: { select: { name: true } }, allocatedCase: { select: { jobsheetNo: true } } },
        orderBy: { allocatedAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export type StockRow = Awaited<ReturnType<typeof listStock>>[number];
export type PurchaseRequestRow = Awaited<ReturnType<typeof listPurchaseRequests>>[number];
export type TransferRow = Awaited<ReturnType<typeof listTransfers>>[number];
export type ActivePurchaseRequestRow = Awaited<ReturnType<typeof listActivePurchaseRequests>>[number];

// ── Stock list (URL-driven: search · tabs · sort · paging) ────────────────────

export const STOCK_SORTS = ["updatedAt", "name", "branch", "quantity"] as const;

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Low stock = 1–2 units; In stock = more than 2. */
const stockTabWhere = (tab: string): Prisma.StockItemWhereInput =>
  tab === "in" ? { quantity: { gt: 2 } }
  : tab === "low" ? { quantity: { gt: 0, lte: 2 } }
  : tab === "out" ? { quantity: 0 }
  : {};

/** A branch view still includes Head Office, where purchased stock is held until it is allocated. */
const withHeadOffice = async (branchId: string | null, includeHeadOffice: boolean) => {
  if (!branchId) return null;
  if (!includeHeadOffice) return { in: [branchId] }; // branch users only ever see their own stock
  const ho = await getHeadOfficeBranch();
  return { in: [...new Set([branchId, ho.id])] };
};

export async function listStockPage(list: ListState, branchId: string | null, includeHeadOffice = false) {
  const inBranches = await withHeadOffice(branchId, includeHeadOffice);
  const scope: Prisma.StockItemWhereInput = inBranches ? { branchId: inBranches } : {};
  const search: Prisma.StockItemWhereInput = list.q
    ? {
        OR: [
          { item: { name: containsI(list.q) } },
          { item: { code: containsI(list.q) } },
          { branch: { name: containsI(list.q) } },
          { branch: { code: containsI(list.q) } },
          { unitCodes: { has: list.q } },
        ],
      }
    : {};
  const base = { AND: [scope, search] };
  const where: Prisma.StockItemWhereInput = { AND: [base, stockTabWhere(list.tab)] };

  const orderBy: Prisma.StockItemOrderByWithRelationInput =
    list.sort === "name" ? { item: { name: list.dir } }
    : list.sort === "branch" ? { branch: { name: list.dir } }
    : { [list.sort]: list.dir };

  const count = (tab: string) => db.stockItem.count({ where: { AND: [base, stockTabWhere(tab)] } });
  const [rows, total, all, inStock, low, out, valueRows] = await Promise.all([
    db.stockItem.findMany({
      where,
      orderBy,
      ...pageArgs(list),
      include: {
        item: { select: { id: true, code: true, name: true, type: true, pricePaise: true, maxDiscountPercent: true } },
        branch: { select: { id: true, code: true, name: true } },
      },
    }),
    db.stockItem.count({ where }),
    count(""),
    count("in"),
    count("low"),
    count("out"),
    db.stockItem.findMany({ where: scope, select: { quantity: true, item: { select: { pricePaise: true } } } }),
  ]);

  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "in", label: "In Stock", count: inStock },
    { key: "low", label: "Low Stock", count: low },
    { key: "out", label: "Out of Stock", count: out },
  ];
  const valuePaise = valueRows.reduce((sum, s) => sum + s.quantity * s.item.pricePaise, 0);
  return { rows, total, tabs, valuePaise };
}

/** Customer returns or warranty claims raised from closed cases, newest first. */
export async function listItemReturns(returnType: "RETURN" | "WARRANTY_CLAIM", branchId: string | null) {
  return db.caseItemReturn.findMany({
    where: { returnType, ...(branchId ? { case: { branchId } } : {}) },
    include: {
      case: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } }, branch: { select: { code: true, name: true } } } },
      caseItem: { select: { name: true, code: true, quantity: true } },
      attachments: { select: { id: true, url: true, fileName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/** Returns/claims still waiting for a decision or for completion, for the tab counts. */
export async function countOpenItemReturns(branchId: string | null) {
  const rows = await db.caseItemReturn.groupBy({
    by: ["returnType"],
    where: { status: { in: ["REQUESTED", "APPROVED"] }, ...(branchId ? { case: { branchId } } : {}) },
    _count: { _all: true },
  });
  const n = (t: string) => rows.find((r) => r.returnType === t)?._count._all ?? 0;
  return { returns: n("RETURN"), warranty: n("WARRANTY_CLAIM") };
}

/**
 * Units allocated to one branch: awaiting its receipt first, then the ones it has received.
 * Always filtered by the user's own branch (never by a request parameter).
 */
export async function listBranchUnits(list: ListState, branchId: string) {
  const where: Prisma.StockUnitWhereInput = {
    allocatedBranchId: branchId,
    status: { in: ["ALLOCATED", "RECEIVED"] },
    ...(list.q
      ? {
          OR: [
            { usid: { contains: list.q, mode: "insensitive" } },
            { item: { name: { contains: list.q, mode: "insensitive" } } },
            { item: { code: { contains: list.q, mode: "insensitive" } } },
            { allocatedCase: { jobsheetNo: { contains: list.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [rows, total, awaiting] = await Promise.all([
    db.stockUnit.findMany({
      where,
      orderBy: [{ status: "asc" }, { allocatedAt: "desc" }, { usid: "asc" }],
      ...pageArgs(list),
      include: {
        item: { select: { code: true, name: true } },
        allocatedCase: { select: { id: true, jobsheetNo: true } },
        allocatedBy: { select: { firstName: true, lastName: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.stockUnit.count({ where }),
    db.stockUnit.count({ where: { allocatedBranchId: branchId, status: "ALLOCATED" } }),
  ]);
  return { rows, total, awaiting };
}

/** Units that can still be allocated, for the Consume dialog. */
export async function listAvailableUnits() {
  return db.stockUnit.findMany({
    where: { status: "AVAILABLE" },
    orderBy: [{ itemId: "asc" }, { usid: "asc" }],
    take: 1000,
    select: {
      id: true,
      usid: true,
      itemId: true,
      item: { select: { name: true } },
      branch: { select: { code: true } },
      billItem: { select: { bill: { select: { billNo: true } } } },
    },
  });
}

const UNIT_TAB_STATUS = ["AVAILABLE", "ALLOCATED", "RECEIVED"] as const;

/** Every purchased unit (one row per USID) at a location, with its bill, supplier and status. */
export async function listStockUnitsPage(list: ListState, branchId: string | null, includeHeadOffice = false) {
  const inBranches = await withHeadOffice(branchId, includeHeadOffice);
  const scope: Prisma.StockUnitWhereInput = inBranches ? { branchId: inBranches } : {};
  const search: Prisma.StockUnitWhereInput = list.q
    ? {
        OR: [
          { usid: containsI(list.q) },
          { item: { name: containsI(list.q) } },
          { item: { code: containsI(list.q) } },
          { billItem: { bill: { billNo: containsI(list.q) } } },
          { billItem: { bill: { supplier: { name: containsI(list.q) } } } },
          { allocatedCase: { jobsheetNo: containsI(list.q) } },
        ],
      }
    : {};
  const status = (UNIT_TAB_STATUS as readonly string[]).includes(list.tab) ? (list.tab as (typeof UNIT_TAB_STATUS)[number]) : null;
  const where: Prisma.StockUnitWhereInput = { AND: [scope, search, status ? { status } : {}] };

  const [rows, total, groups] = await Promise.all([
    db.stockUnit.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { usid: "asc" }],
      ...pageArgs(list),
      include: {
        item: { select: { code: true, name: true } },
        branch: { select: { code: true, name: true } },
        billItem: { select: { bill: { select: { id: true, billNo: true, supplier: { select: { name: true } } } } } },
        allocatedCase: { select: { id: true, jobsheetNo: true } },
        allocatedBranch: { select: { code: true } },
      },
    }),
    db.stockUnit.count({ where }),
    db.stockUnit.groupBy({ by: ["status"], where: { AND: [scope, search] }, _count: { _all: true } }),
  ]);
  const n = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
    { key: "AVAILABLE", label: "Available", count: n("AVAILABLE") },
    { key: "ALLOCATED", label: "Allocated", count: n("ALLOCATED") },
    { key: "RECEIVED", label: "Received", count: n("RECEIVED") },
  ];
  return { rows, total, tabs };
}

/** Available units per branch + item, so the Stock table can show how its count compares with registered USIDs. */
export async function countAvailableUnits(branchId: string | null, includeHeadOffice = false) {
  const inBranches = await withHeadOffice(branchId, includeHeadOffice);
  const groups = await db.stockUnit.groupBy({
    by: ["branchId", "itemId"],
    where: { status: "AVAILABLE", ...(inBranches ? { branchId: inBranches } : {}) },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [`${g.branchId}:${g.itemId}`, g._count._all]));
}
