import "server-only";
import { db } from "@/server/db";
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
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function listReceivedRequests(branchId: string | null) {
  return db.purchaseRequest.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      status: "FULFILLED",
    },
    include: {
      item: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      requestedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export type StockRow = Awaited<ReturnType<typeof listStock>>[number];
export type PurchaseRequestRow = Awaited<ReturnType<typeof listPurchaseRequests>>[number];
export type TransferRow = Awaited<ReturnType<typeof listTransfers>>[number];
export type ActivePurchaseRequestRow = Awaited<ReturnType<typeof listActivePurchaseRequests>>[number];
export type ReceivedRequestRow = Awaited<ReturnType<typeof listReceivedRequests>>[number];

// ── Stock list (URL-driven: search · tabs · sort · paging) ────────────────────

export const STOCK_SORTS = ["updatedAt", "name", "branch", "quantity"] as const;

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Low stock = 1–2 units; In stock = more than 2. */
const stockTabWhere = (tab: string): Prisma.StockItemWhereInput =>
  tab === "in" ? { quantity: { gt: 2 } }
  : tab === "low" ? { quantity: { gt: 0, lte: 2 } }
  : tab === "out" ? { quantity: 0 }
  : {};

export async function listStockPage(list: ListState, branchId: string | null) {
  const scope: Prisma.StockItemWhereInput = branchId ? { branchId } : {};
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
