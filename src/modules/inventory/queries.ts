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

/** Purchase requests by stage: "requests" (raised, not yet ordered) or "ordered" (waiting for a unit to be transferred). */
/** Requests of a branch: the ones it raised, and the ones raised for its cases (e.g. by the chip-level lab). */
const requestBranch = (branchId: string | null): Prisma.PurchaseRequestWhereInput =>
  branchId ? { OR: [{ branchId }, { case: { branchId } }] } : {};

export async function listPurchaseRequestsByStage(list: ListState, stage: "requests" | "ordered", branchId: string | null) {
  const where: Prisma.PurchaseRequestWhereInput = {
    AND: [requestBranch(branchId)],
    status: stage === "ordered" ? "ORDERED" : { in: ["PENDING", "WITH_PM", "APPROVED", "SPARE_UNAVAILABLE"] },
    ...(list.q
      ? {
          OR: [
            { code: containsI(list.q) },
            { modelNo: containsI(list.q) },
            { item: { name: containsI(list.q) } },
            { item: { code: containsI(list.q) } },
            { case: { jobsheetNo: containsI(list.q) } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.purchaseRequest.findMany({
      where,
      include: {
      item: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      case: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } }, branch: { select: { code: true, name: true } } } },
      requestedBy: { select: { firstName: true, lastName: true } },
      replacementConfirmedBy: { select: { firstName: true, lastName: true } },
      replacementOf: { select: { code: true } },
      attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
      stockUnits: {
        select: { id: true, usid: true, status: true, receivedAt: true, item: { select: { name: true } }, allocatedCase: { select: { jobsheetNo: true } } },
        orderBy: { allocatedAt: "asc" },
      },
    },
      // Replacement / Reorder requests (a defective unit being replaced) come first so they can be prioritised.
    orderBy: [{ isReplacement: "desc" }, stage === "ordered" ? { orderedAt: "desc" } : { createdAt: "desc" }],
      ...pageArgs(list),
    }),
    db.purchaseRequest.count({ where }),
  ]);
  return { rows, total };
}

/** Tab counts for Purchasing, limited to one branch when given. */
export async function purchasingCounts(branchId: string | null) {
  const [requests, ordered, inTransit, notConsumed, unitReturns] = await Promise.all([
    db.purchaseRequest.count({ where: { AND: [requestBranch(branchId)], status: { in: ["PENDING", "WITH_PM", "APPROVED", "SPARE_UNAVAILABLE"] } } }),
    db.purchaseRequest.count({ where: { AND: [requestBranch(branchId)], status: "ORDERED" } }),
    db.stockUnit.count({ where: { ...(branchId ? { allocatedBranchId: branchId } : {}), status: "ALLOCATED" } }),
    db.stockUnit.count({ where: { ...(branchId ? { allocatedBranchId: branchId } : {}), status: "RECEIVED" } }),
    // courier damage returns, plus vendor replacements still open (defective unit not received yet, or replacement in progress)
    db.stockUnit.count({ where: { ...(branchId ? { allocatedBranchId: branchId } : {}), status: "RETURNED" } }).then(
      async (n) => n + (await db.vendorReplacement.count({ where: { ...(branchId ? { branchId } : {}), OR: [{ returnReceivedAt: null }, { status: { not: "RECEIVED" } }] } })),
    ),
  ]);
  return { requests, ordered, inTransit, notConsumed, unitReturns };
}

export type StockRow = Awaited<ReturnType<typeof listStock>>[number];
export type PurchaseRequestRow = Awaited<ReturnType<typeof listPurchaseRequests>>[number];
export type TransferRow = Awaited<ReturnType<typeof listTransfers>>[number];
export type ActivePurchaseRequestRow = Awaited<ReturnType<typeof listPurchaseRequestsByStage>>["rows"][number];

// ── Stock list (URL-driven: search · tabs · sort · paging) ────────────────────

export const STOCK_SORTS = ["updatedAt", "name", "branch", "quantity"] as const;

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Low stock = 1–2 units; In stock = more than 2. */
const stockTabWhere = (tab: string): Prisma.StockItemWhereInput =>
  tab === "in" ? { quantity: { gt: 2 } }
  : tab === "low" ? { quantity: { gt: 0, lte: 2 } }
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
  // Only items actually on hand are listed; rows that have run down to 0 are hidden.
  const scope: Prisma.StockItemWhereInput = { quantity: { gt: 0 }, ...(inBranches ? { branchId: inBranches } : {}) };
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
  const [rows, total, all, inStock, low, valueRows] = await Promise.all([
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
    db.stockItem.findMany({ where: scope, select: { quantity: true, item: { select: { pricePaise: true } } } }),
  ]);

  const tabs: FilterTab[] = [
    { key: "", label: "All", count: all },
    { key: "in", label: "In Stock", count: inStock },
    { key: "low", label: "Low Stock", count: low },
  ];
  const valuePaise = valueRows.reduce((sum, s) => sum + s.quantity * s.item.pricePaise, 0);
  return { rows, total, tabs, valuePaise };
}

/** Customer returns or warranty claims raised from closed cases, newest first. */
export async function listItemReturns(list: ListState, returnType: "RETURN" | "WARRANTY_CLAIM", branchId: string | null) {
  const where: Prisma.CaseItemReturnWhereInput = {
    returnType,
    ...(branchId ? { case: { branchId } } : {}),
    ...(list.q
      ? {
          OR: [
            { caseItem: { name: containsI(list.q) } },
            { case: { jobsheetNo: containsI(list.q) } },
            { case: { customer: { name: containsI(list.q) } } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.caseItemReturn.findMany({
      where,
      include: {
      case: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } }, branch: { select: { code: true, name: true } } } },
      caseItem: { select: { itemId: true, name: true, code: true, quantity: true } },
      attachments: { select: { id: true, url: true, fileName: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      reviewedBy: { select: { firstName: true, lastName: true } },
    },
      orderBy: { createdAt: "desc" },
      ...pageArgs(list),
    }),
    db.caseItemReturn.count({ where }),
  ]);
  return { rows, total };
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
 * Units transferred to branches, filtered by status: the Transferred tab (everything transferred) and the
 * Consumed tab (received, and used). Pass the branch to limit it to one; branch users always pass their own.
 */
export async function listTransferredUnits(list: ListState, branchId: string | null, statuses: ("ALLOCATED" | "RECEIVED" | "CONSUMED")[]) {
  const where: Prisma.StockUnitWhereInput = {
    ...(branchId ? { allocatedBranchId: branchId } : {}),
    status: { in: statuses },
    ...(list.q
      ? {
          OR: [
            { usid: containsI(list.q) },
            { item: { name: containsI(list.q) } },
            { item: { code: containsI(list.q) } },
            { allocatedCase: { jobsheetNo: containsI(list.q) } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    db.stockUnit.findMany({
      where,
      orderBy: [{ allocatedAt: "desc" }, { usid: "asc" }],
      ...pageArgs(list),
      include: {
        item: { select: { code: true, name: true } },
        allocatedCase: { select: { id: true, jobsheetNo: true } },
        allocatedBranch: { select: { code: true, name: true } },
        allocatedBy: { select: { firstName: true, lastName: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        consumedBy: { select: { firstName: true, lastName: true } },
        billItem: { select: { bill: { select: { code: true, billNo: true, supplier: { select: { name: true } } } } } },
        purchaseRequest: { select: { code: true, modelNo: true, notes: true, pmRemarks: true } },
        vendorReplacements: { where: { status: { in: ["TRANSFERRED", "RECEIVED"] } }, select: { code: true }, take: 1 },
        attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    db.stockUnit.count({ where }),
  ]);
  return { rows, total };
}

/**
 * USIDs returned from cases and still open: courier / branch damage (a replacement is bought) and defective ones waiting for
 * the vendor to replace them. Each comes with the replacement request raised for its case, if any.
 */
export async function listUnitReturns(branchId: string | null) {
  const rows = await db.stockUnit.findMany({
    where: { status: "RETURNED", ...(branchId ? { allocatedBranchId: branchId } : {}) },
    orderBy: { returnedAt: "desc" },
    take: 50,
    include: {
      item: { select: { code: true, name: true } },
      allocatedCase: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } } } },
      allocatedBranch: { select: { code: true, name: true } },
      allocatedBy: { select: { firstName: true, lastName: true } },
      receivedBy: { select: { firstName: true, lastName: true } },
      consumedBy: { select: { firstName: true, lastName: true } },
      billItem: { select: { bill: { select: { code: true, billNo: true, supplier: { select: { name: true } } } } } },
      purchaseRequest: { select: { id: true, code: true, modelNo: true, notes: true, pmRemarks: true } },
      attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
    },
  });
  const originals = rows.map((r) => r.purchaseRequest?.id).filter((id): id is string => Boolean(id));
  const replacements = originals.length
    ? await db.purchaseRequest.findMany({
        where: { replacementOfId: { in: originals } },
        select: { replacementOfId: true, code: true, status: true, stockUnits: { select: { usid: true, status: true } } },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const byOriginal = new Map<string, { code: string; status: string; units: { usid: string; status: string }[] }>();
  for (const r of replacements) {
    if (r.replacementOfId && !byOriginal.has(r.replacementOfId)) byOriginal.set(r.replacementOfId, { code: r.code, status: r.status, units: r.stockUnits });
  }
  return { rows, replacementOf: byOriginal };
}

const unitDetailInclude = {
  item: { select: { code: true, name: true } },
  allocatedCase: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } } } },
  allocatedBranch: { select: { code: true, name: true } },
  allocatedBy: { select: { firstName: true, lastName: true } },
  receivedBy: { select: { firstName: true, lastName: true } },
  consumedBy: { select: { firstName: true, lastName: true } },
  billItem: { select: { bill: { select: { code: true, billNo: true, supplier: { select: { name: true } } } } } },
  purchaseRequest: { select: { id: true, code: true, modelNo: true, notes: true, pmRemarks: true } },
  attachments: { select: { id: true, url: true, fileName: true }, orderBy: { createdAt: "asc" } },
} as const;

/**
 * Defective / not-working units sent back for a vendor replacement, for the Purchasing Returns tab. A row stays until the
 * defective unit has been received at Head Office AND the replacement has been received by the branch: the two are tracked
 * separately and neither waits for the other.
 */
export async function listVendorReturns(branchId: string | null) {
  return db.vendorReplacement.findMany({
    where: { ...(branchId ? { branchId } : {}), OR: [{ returnReceivedAt: null }, { status: { not: "RECEIVED" } }] },
    orderBy: { requestedAt: "desc" },
    take: 50,
    include: {
      unit: { include: unitDetailInclude },
      case: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } } } },
      branch: { select: { code: true, name: true } },
      item: { select: { code: true, name: true } },
    },
  });
}

/** Open vendor replacements per item for one case (anything not yet received by the branch), for the case item rows. */
export async function openVendorReplacementsForCase(caseId: string): Promise<Record<string, string>> {
  const rows = await db.vendorReplacement.findMany({ where: { caseId, status: { not: "RECEIVED" } }, orderBy: { requestedAt: "asc" }, select: { itemId: true, status: true } });
  return Object.fromEntries(rows.map((r) => [r.itemId, r.status]));
}

export const VR_SORTS = ["requestedAt"] as const;
const VR_TABS = ["REQUESTED", "READY", "TRANSFERRED", "RECEIVED"] as const;

/** The Vendor Replacements page: every replacement with its vendor, transfer and branch-receipt status. */
export async function listVendorReplacementsPage(list: ListState, branchId: string | null) {
  const status = (VR_TABS as readonly string[]).includes(list.tab) ? (list.tab as (typeof VR_TABS)[number]) : null;
  const base: Prisma.VendorReplacementWhereInput = {
    ...(branchId ? { branchId } : {}),
    ...(list.q
      ? {
          OR: [
            { code: containsI(list.q) },
            { vendorName: containsI(list.q) },
            { unit: { usid: containsI(list.q) } },
            { item: { name: containsI(list.q) } },
            { case: { jobsheetNo: containsI(list.q) } },
          ],
        }
      : {}),
  };
  const where: Prisma.VendorReplacementWhereInput = { ...base, ...(status ? { status } : {}) };
  const [rows, total, groups] = await Promise.all([
    db.vendorReplacement.findMany({
      where,
      orderBy: { requestedAt: list.dir },
      ...pageArgs(list),
      include: {
        unit: { select: { usid: true, status: true } },
        case: { select: { id: true, jobsheetNo: true, customer: { select: { name: true } } } },
        branch: { select: { code: true, name: true } },
        item: { select: { code: true, name: true } },
      },
    }),
    db.vendorReplacement.count({ where }),
    db.vendorReplacement.groupBy({ by: ["status"], where: base, _count: { _all: true } }),
  ]);
  const n = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: groups.reduce((s, g) => s + g._count._all, 0) },
    { key: "REQUESTED", label: "Awaiting vendor", count: n("REQUESTED") },
    { key: "READY", label: "Ready", count: n("READY") },
    { key: "TRANSFERRED", label: "Transferred", count: n("TRANSFERRED") },
    { key: "RECEIVED", label: "Received", count: n("RECEIVED") },
  ];
  return { rows, total, tabs };
}

/** The USID(s) consumed on each case for these items: the identity of a part returned after the case closed. Key: caseId:itemId. */
export async function consumedUsidsFor(pairs: { caseId: string; itemId: string }[]): Promise<Map<string, string>> {
  if (pairs.length === 0) return new Map();
  const units = await db.stockUnit.findMany({
    where: { status: "CONSUMED", allocatedCaseId: { in: [...new Set(pairs.map((p) => p.caseId))] }, itemId: { in: [...new Set(pairs.map((p) => p.itemId))] } },
    orderBy: { consumedAt: "asc" },
    select: { usid: true, itemId: true, allocatedCaseId: true },
  });
  const out = new Map<string, string>();
  for (const u of units) {
    const key = `${u.allocatedCaseId}:${u.itemId}`;
    out.set(key, out.has(key) ? `${out.get(key)}, ${u.usid}` : u.usid);
  }
  return out;
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

const UNIT_TAB_STATUS = ["AVAILABLE", "ALLOCATED", "RECEIVED", "CONSUMED", "RETURNED", "AWAITING_VENDOR"] as const;

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
    { key: "CONSUMED", label: "Consumed", count: n("CONSUMED") },
    { key: "RETURNED", label: "Returned", count: n("RETURNED") + n("AWAITING_VENDOR") },
  ];
  return { rows, total, tabs };
}

/** On-hand units per branch + item, so the Stock table can show how its count compares with registered USIDs. */
export async function countAvailableUnits(branchId: string | null, includeHeadOffice = false) {
  const inBranches = await withHeadOffice(branchId, includeHeadOffice);
  const groups = await db.stockUnit.groupBy({
    by: ["branchId", "itemId"],
    // Units on hand: available at Head Office, or received at a branch and not yet used.
    where: { status: { in: ["AVAILABLE", "RECEIVED"] }, ...(inBranches ? { branchId: inBranches } : {}) },
    _count: { _all: true },
  });
  return new Map(groups.map((g) => [`${g.branchId}:${g.itemId}`, g._count._all]));
}
