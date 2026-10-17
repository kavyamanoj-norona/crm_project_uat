import "server-only";
import { db } from "@/server/db";
import { caseUsids, consumableUnits } from "@/modules/inventory/case-parts";
import { getHeadOfficeBranch } from "@/modules/inventory/head-office";
import { openVendorReplacementsForCase } from "@/modules/inventory/queries";
import { CaseStatus, type Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import { todayIst } from "@/lib/dates";
import type { FilterTab } from "@/components/data/filter-tabs";

const containsI = (q: string) => ({ contains: q, mode: "insensitive" as const });

const LAB_QUEUE_STATUSES: CaseStatus[] = [
  CaseStatus.CHIP_TRANSFER,
  CaseStatus.CHIP_LAB_RECEIVED,
  CaseStatus.CHIP_LAB_DIAGNOSIS,
  CaseStatus.CHIP_LAB_PENDING_APPROVAL,
  CaseStatus.CHIP_LAB_SERVICING,
  CaseStatus.CHIP_LAB_READY_DISPATCH,
  CaseStatus.CHIP_LAB_QUALITY_CHECK,
  CaseStatus.NON_REPAIRABLE,
];

export const LAB_LIST_SORTS = ["stageChangedAt", "jobsheetNo", "createdAt"] as const;

/** Cases the lab is working on. */
const inProgressWhere: Prisma.CaseWhereInput = { status: { in: LAB_QUEUE_STATUSES } };
/** Cases the lab has transferred to the branch (they may have moved on at the branch since). */
const completedWhere: Prisma.CaseWhereInput = {
  status: { notIn: LAB_QUEUE_STATUSES },
  statusHistory: { some: { toStatus: CaseStatus.CHIP_BRANCH_RECEIVED } },
};

/**
 * The lab list: In Progress / Completed tabs, search, sort and paging, plus how
 * many cases were transferred to a branch today (IST).
 */
export async function listLabCasesPage(list: ListState) {
  const search: Prisma.CaseWhereInput = list.q
    ? {
        OR: [
          { jobsheetNo: containsI(list.q) },
          { brand: containsI(list.q) },
          { model: containsI(list.q) },
          { serialNo: containsI(list.q) },
          { customer: { name: containsI(list.q) } },
          { account: { name: containsI(list.q) } },
          { branch: { OR: [{ name: containsI(list.q) }, { code: containsI(list.q) }] } },
        ],
      }
    : {};
  const completedTab = list.tab === "completed";
  const where: Prisma.CaseWhereInput = { AND: [search, completedTab ? completedWhere : inProgressWhere] };
  const dayStart = new Date(`${todayIst()}T00:00:00+05:30`);

  const [rows, total, inProgress, completed, doneToday] = await Promise.all([
    db.case.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      select: {
        id: true,
        jobsheetNo: true,
        brand: true,
        model: true,
        status: true,
        createdAt: true,
        stageChangedAt: true,
        estimatedCostPaise: true,
        labTransferCompletedAt: true,
        branch: { select: { code: true, name: true } },
        customer: { select: { name: true } },
        account: { select: { name: true } },
        labOutsources: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { actualReturnAt: true, vendor: { select: { name: true } } },
        },
        // newest first: the first hit per status is the current round
        statusHistory: {
          where: { toStatus: { in: [CaseStatus.CHIP_LAB_RECEIVED, CaseStatus.CHIP_BRANCH_RECEIVED] } },
          orderBy: { at: "desc" },
          select: { toStatus: true, at: true },
        },
      },
    }),
    db.case.count({ where }),
    db.case.count({ where: { AND: [search, inProgressWhere] } }),
    db.case.count({ where: { AND: [search, completedWhere] } }),
    db.caseStatusHistory.findMany({
      where: { toStatus: CaseStatus.CHIP_BRANCH_RECEIVED, at: { gte: dayStart } },
      distinct: ["caseId"],
      select: { caseId: true },
    }),
  ]);

  const tabs: FilterTab[] = [
    { key: "", label: "In Progress", count: inProgress },
    { key: "completed", label: "Completed", count: completed },
  ];
  const nowMs = Date.now();
  return {
    rows: rows.map((r) => ({ ...r, ageDays: Math.floor((nowMs - r.stageChangedAt.getTime()) / 86400000) })),
    total,
    tabs,
    completedToday: doneToday.length,
  };
}

export type LabListRow = Awaited<ReturnType<typeof listLabCasesPage>>["rows"][number];

/** Counts per status for the lab KPI tiles. */
export async function labStatusCounts() {
  const rows = await db.case.groupBy({
    by: ["status"],
    where: { status: { in: LAB_QUEUE_STATUSES } },
    _count: { _all: true },
  });
  const map: Partial<Record<CaseStatus, number>> = {};
  for (const r of rows) map[r.status] = r._count._all;
  return map;
}

/** Single case with all lab-relevant relations (returns null if not a lab case). */
export async function getLabCase(id: string) {
  return db.case.findFirst({
    where: { id, status: { in: LAB_QUEUE_STATUSES } },
    include: {
      branch: { select: { code: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      account: { select: { name: true } },
      engineer: { select: { id: true, firstName: true, lastName: true } },
      statusHistory: {
        orderBy: { at: "asc" },
        include: { changedBy: { select: { firstName: true, lastName: true } } },
      },
      labOutsources: {
        orderBy: { createdAt: "desc" },
        include: {
          vendor: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export type LabCaseDetails = NonNullable<Awaited<ReturnType<typeof getLabCase>>>;

/** Full lab case detail — includes billing items; visible for all chip-track statuses including dispatched. */
export async function getLabCaseFull(id: string) {
  return db.case.findFirst({
    where: {
      id,
      // In the lab, or transferred to a branch (completed) and since moved on there.
      OR: [
        { status: { in: [...LAB_QUEUE_STATUSES, CaseStatus.CHIP_BRANCH_RECEIVED] } },
        { statusHistory: { some: { toStatus: CaseStatus.CHIP_BRANCH_RECEIVED } } },
      ],
    },
    include: {
      branch: { select: { code: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      account: { select: { name: true } },
      engineer: { select: { id: true, firstName: true, lastName: true } },
      labEngineer: { select: { id: true, firstName: true, lastName: true } },
      labVendor: { select: { id: true, name: true } },
      labTransferBy: { select: { firstName: true, lastName: true } },
      items: {
        where: { removedAt: null },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          itemId: true,
          code: true,
          name: true,
          type: true,
          quantity: true,
          listPricePaise: true,
          minPricePaise: true,
          unitPricePaise: true,
          lineTotalPaise: true,
          gstPercent: true,
          vendorCostPaise: true,
        },
      },
      // Advance / payments the customer has made on this case
      payments: { select: { amountPaise: true } },
      // Money paid out to the outsource vendor
      labVendorPayments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true,
          amountPaise: true,
          note: true,
          paidAt: true,
          paidBy: { select: { firstName: true, lastName: true } },
        },
      },
      statusHistory: {
        orderBy: { at: "desc" },
        include: { changedBy: { select: { firstName: true, lastName: true } } },
      },
      labOutsources: {
        orderBy: { createdAt: "desc" },
        include: {
          vendor: true,
          createdBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
}

export type LabCaseFullDetails = NonNullable<Awaited<ReturnType<typeof getLabCaseFull>>>;

/**
 * Units on hand per item at the case's branch (the lab is a service provider: parts used on a case are always
 * taken from, and recorded against, the case's own branch), and the items with a request still open for this case.
 */
export async function getLabStockInfo(caseId: string, _caseBranchId: string) {
  // The lab works from Head Office stock only, so nothing here looks at the case's own branch.
  const branchId = (await getHeadOfficeBranch()).id;
  const [stock, open, usages, received, heldAtBranch] = await Promise.all([
    db.stockItem.findMany({ where: { branchId, quantity: { gt: 0 } }, select: { itemId: true, quantity: true } }),
    db.purchaseRequest.findMany({
      where: { caseId, status: { notIn: ["FULFILLED", "REJECTED"] } },
      orderBy: { createdAt: "asc" },
      select: { itemId: true, status: true },
    }),
    db.caseItemUsage.findMany({ where: { caseId, kind: { in: ["CONSUMED", "RETURNED_UNUSED"] } }, select: { itemId: true, kind: true } }),
    db.stockUnit.findMany({ where: { allocatedCaseId: caseId, status: "RECEIVED" }, select: { itemId: true } }),
    db.stockUnit.groupBy({ by: ["itemId"], where: { branchId, status: { in: ["RECEIVED", "AVAILABLE"] }, isOfficeUse: false }, _count: { _all: true } }),
  ]);
  const held = new Map(heldAtBranch.map((h) => [h.itemId, h._count._all]));
  const items = await db.caseItem.findMany({ where: { caseId, removedAt: null }, select: { itemId: true } });
  const [consumable, usids, vendorReplacement] = await Promise.all([
    consumableUnits(caseId, branchId, [...new Set(items.map((i) => i.itemId))], { includeAvailable: true }),
    caseUsids(caseId),
    openVendorReplacementsForCase(caseId),
  ]);
  // The latest request per item decides its state: a transferred one can be reordered if the unit is faulty.
  const latest = new Map(open.map((r) => [r.itemId, r.status]));
  return {
    // free stock: units received for cases are held for them, so they are not counted here
    stock: Object.fromEntries(stock.map((s) => [s.itemId, Math.max(0, s.quantity - (held.get(s.itemId) ?? 0))])),
    /** Items already used on this case (or returned unused). */
    settled: Object.fromEntries(usages.map((u) => [u.itemId, u.kind])) as Record<string, string>,
    /** Items with a received unit waiting to be used on this case. */
    received: [...new Set(received.map((r) => r.itemId))],
    /** Units received at the case's branch and unused, per item: the USIDs that can be consumed. */
    consumable: consumable,
    /** The USID allocated to the case for each item. */
    usids: usids,
    /** Open vendor replacements per item (defective unit being replaced under the same USID). */
    vendorReplacement: vendorReplacement,
    requested: [...latest.keys()],
    transferred: [...latest].filter(([, st]) => st === "TRANSFERRED" || st === "CONSUMED").map(([id]) => id),
  };
}

// ── Vendors ───────────────────────────────────────────────────────────────────

export async function listVendors() {
  return db.chipLabVendor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      isActive: true,
      remarks: true,
      createdAt: true,
    },
  });
}

export type VendorRow = Awaited<ReturnType<typeof listVendors>>[number];

export async function getVendor(id: string) {
  return db.chipLabVendor.findUnique({ where: { id } });
}

export type VendorDetails = NonNullable<Awaited<ReturnType<typeof getVendor>>>;

export async function listVendorOptions() {
  const rows = await db.chipLabVendor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return rows.map((r) => ({ value: r.id, label: r.name }));
}

/** Chip-lab engineers (users with the CHIP_LAB_ENGINEER privilege) as options for the lab work-type form. */
export async function listLabEngineers() {
  const rows = await db.user.findMany({
    where: {
      isActive: true,
      status: "WORKING",
      privilege: { code: "CHIP_LAB_ENGINEER" },
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });
  return rows.map((u) => ({
    value: u.id,
    label: [u.firstName, u.lastName].filter(Boolean).join(" "),
  }));
}

/** All vendors (active and inactive) — for the admin/vendor-master page. */
export async function listAllVendors() {
  return db.chipLabVendor.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      contactName: true,
      phone: true,
      email: true,
      address: true,
      isActive: true,
      remarks: true,
      createdAt: true,
    },
  });
}

export type VendorListRow = Awaited<ReturnType<typeof listAllVendors>>[number];

// ── Vendor list (URL-driven: search · tabs · sort · paging) ─────────────────────

export const VENDOR_SORTS = ["name", "createdAt"] as const;

export async function listVendorsPage(list: ListState) {
  const search: Prisma.ChipLabVendorWhereInput = list.q
    ? {
        OR: [
          { name: containsI(list.q) },
          { contactName: containsI(list.q) },
          { phone: containsI(list.q) },
          { email: containsI(list.q) },
        ],
      }
    : {};
  const where = search;
  const [rows, total] = await Promise.all([
    db.chipLabVendor.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      select: {
        id: true,
        name: true,
        contactName: true,
        phone: true,
        email: true,
        address: true,
        isActive: true,
        remarks: true,
        createdAt: true,
      },
    }),
    db.chipLabVendor.count({ where }),
  ]);
  return { rows, total, tabs: [] as FilterTab[] };
}

export type VendorPageRow = Awaited<ReturnType<typeof listVendorsPage>>["rows"][number];
