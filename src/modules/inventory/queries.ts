import "server-only";
import { db } from "@/server/db";

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
