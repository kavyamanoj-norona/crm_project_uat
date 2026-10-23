import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { pageArgs, type ListState } from "@/lib/list";
import type { FilterTab } from "@/components/data/filter-tabs";
import { normalizeBillNo } from "./billing-schema";
import { warrantyApproxDays } from "./warranty-schema";

export const BILL_SORTS = ["billDate", "totalPaise", "createdAt"] as const;

const PAYMENT_TABS = ["UNPAID", "PARTIAL", "PAID"] as const;

/** Bills in the user's branch scope (`scope` = branchWhere(...)), one page at a time. */
/** All purchase bills. They belong to the Head Office, so they are not filtered by branch. */
export async function listBills(list: ListState & { sort: (typeof BILL_SORTS)[number] }) {
  const status = (PAYMENT_TABS as readonly string[]).includes(list.tab) ? (list.tab as (typeof PAYMENT_TABS)[number]) : null;
  const where: Prisma.PurchaseBillWhereInput = {
    ...(status ? { paymentStatus: status } : {}),
    ...(list.q
      ? {
          OR: [
            { billNo: { contains: list.q, mode: "insensitive" } },
            { code: { contains: list.q, mode: "insensitive" } },
            { supplier: { name: { contains: list.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [rows, total, counts] = await Promise.all([
    db.purchaseBill.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      include: {
        supplier: { select: { name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { items: { where: { isDelete: 0 } } } },
      },
    }),
    db.purchaseBill.count({ where }),
    db.purchaseBill.groupBy({ by: ["paymentStatus"], _count: { _all: true } }),
  ]);

  const count = (s: string) => counts.find((c) => c.paymentStatus === s)?._count._all ?? 0;
  const tabs: FilterTab[] = [
    { key: "", label: "All", count: counts.reduce((s, c) => s + c._count._all, 0) },
    { key: "UNPAID", label: "Unpaid", count: count("UNPAID") },
    { key: "PARTIAL", label: "Part paid", count: count("PARTIAL") },
    { key: "PAID", label: "Paid", count: count("PAID") },
  ];
  return { rows, total, tabs };
}

export async function getBill(id: string) {
  return db.purchaseBill.findFirst({
    where: { id },
    include: {
      supplier: true,
      branch: { select: { code: true, name: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      // Nested reads are not filtered by the soft-delete extension, so hide removed lines and units here.
      items: {
        where: { isDelete: 0 },
        orderBy: { sortOrder: "asc" },
        include: {
          item: { select: { code: true, name: true, unit: true } },
          warranty: { select: { name: true } },
          stockUnits: {
            where: { isDelete: 0 },
            orderBy: { usid: "asc" },
            select: {
              id: true,
              usid: true,
              status: true,
              allocatedAt: true,
              receivedAt: true,
              isOfficeUse: true,
              warrantyEndsAt: true,
              officeRemarks: true,
              consumedAt: true,
              officeEmployee: { select: { firstName: true, lastName: true } },
              allocatedCase: { select: { jobsheetNo: true } },
              allocatedBranch: { select: { code: true } },
            },
          },
        },
      },
      payments: { orderBy: { paidAt: "desc" }, include: { createdBy: { select: { firstName: true, lastName: true } } } },
    },
  });
}

/** Active suppliers for the bill form's supplier dropdown. */
export async function listSuppliers() {
  return db.supplier.findMany({
    where: { isDelete: 0 },
    select: { id: true, name: true, gstin: true, state: true, phone: true, email: true, address: true },
    orderBy: { name: "asc" },
  });
}

export const SUPPLIER_SORTS = ["name", "createdAt"] as const;

export async function listSuppliersPage(list: ListState & { sort: (typeof SUPPLIER_SORTS)[number] }) {
  const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });
  const where: Prisma.SupplierWhereInput = list.q
    ? { OR: [{ name: ci(list.q) }, { gstin: ci(list.q) }, { phone: ci(list.q) }, { email: ci(list.q) }] }
    : {};
  const [rows, total] = await Promise.all([
    db.supplier.findMany({
      where,
      orderBy: { [list.sort]: list.dir },
      ...pageArgs(list),
      include: { _count: { select: { bills: true } } },
    }),
    db.supplier.count({ where }),
  ]);
  return { rows, total, tabs: [] as FilterTab[] };
}

export type SupplierPageRow = Awaited<ReturnType<typeof listSuppliersPage>>["rows"][number];

/** Every active stockable item (parts and accessories). Services are labour, not bought stock, so they are left out. */
/** Active warranty periods for the dropdown on bill lines, shortest first. */
export async function listWarranties() {
  const rows = await db.warranty.findMany({ where: { isActive: true, isDelete: 0 }, select: { id: true, name: true, durationValue: true, durationUnit: true } });
  return rows
    .sort((a, b) => warrantyApproxDays(a.durationValue, a.durationUnit) - warrantyApproxDays(b.durationValue, b.durationUnit))
    .map(({ id, name }) => ({ id, name }));
}

export async function listBillableItems() {
  return db.item.findMany({
    where: { isActive: true, type: { not: "SERVICE" } },
    select: { id: true, code: true, name: true, gstPercent: true, hsnSac: true },
    orderBy: { name: "asc" },
  });
}

/**
 * An existing bill that this one would duplicate: same image file, or the same
 * supplier (GSTIN, else name) with the same bill number. Null when it's new.
 */
export async function findDuplicateBill(input: {
  supplierGstin?: string | null;
  supplierName?: string | null;
  billNo?: string | null;
  imageHash?: string | null;
}) {
  const select = { id: true, code: true, billNo: true, supplier: { select: { name: true } } } as const;

  if (input.imageHash) {
    const byImage = await db.purchaseBill.findFirst({ where: { imageHash: input.imageHash }, select });
    if (byImage) return byImage;
  }

  const norm = input.billNo ? normalizeBillNo(input.billNo) : "";
  if (!norm) return null;
  const supplier = input.supplierGstin
    ? await db.supplier.findUnique({ where: { gstin: input.supplierGstin.toUpperCase() }, select: { id: true } })
    : input.supplierName
      ? await db.supplier.findFirst({ where: { name: { equals: input.supplierName.trim(), mode: "insensitive" } }, select: { id: true } })
      : null;
  if (!supplier) return null;
  return db.purchaseBill.findFirst({ where: { supplierId: supplier.id, billNoNorm: norm }, select });
}

/** Active item categories, for items created on a purchase bill. */
export function listItemCategoryOptions() {
  return db.itemCategory.findMany({ where: { isDelete: 0, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}
