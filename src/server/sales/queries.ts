import "server-only";
import { db } from "@/server/db";
import type { BranchScope } from "@/server/branch-scope";
import { branchWhere } from "@/server/branch-scope";

// Accessories in stock at the branch (ItemType = ACCESSORY, qty > 0)
export async function listAccessoryStock(scope: BranchScope) {
  return db.stockItem.findMany({
    where: {
      ...branchWhere(scope),
      quantity: { gt: 0 },
      item: { isActive: true, type: "ACCESSORY" },
    },
    include: {
      item: { select: { id: true, code: true, name: true, pricePaise: true, maxDiscountPercent: true } },
      branch: { select: { id: true, code: true } },
    },
    orderBy: { item: { name: "asc" } },
  });
}

// Refurbished items available at the branch
export async function listRefurbStock(scope: BranchScope) {
  return db.refurbItem.findMany({
    where: { ...branchWhere(scope), status: "AVAILABLE", isActive: true },
    orderBy: { addedAt: "desc" },
  });
}

// Recent buyback records at the branch
export async function listBuybacks(scope: BranchScope) {
  return db.buybackRecord.findMany({
    where: { ...branchWhere(scope), isActive: true },
    include: {
      recordedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { recordedAt: "desc" },
    take: 20,
  });
}

// Direct sales history at the branch
export async function listDirectSales(scope: BranchScope) {
  return db.directSale.findMany({
    where: { ...branchWhere(scope), isActive: true },
    include: {
      items: { include: { item: { select: { id: true, name: true } } } },
      soldBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { soldAt: "desc" },
    take: 20,
  });
}

export type AccessoryStockRow = Awaited<ReturnType<typeof listAccessoryStock>>[number];
export type RefurbRow = Awaited<ReturnType<typeof listRefurbStock>>[number];
export type BuybackRow = Awaited<ReturnType<typeof listBuybacks>>[number];
