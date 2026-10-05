"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { requireActionPermission } from "@/server/rbac/guard";
import { getBranchScope } from "@/server/branch-scope";
import { nextSequence } from "@/server/sequence";
import { SALES_PATHS } from "@/modules/sales/paths";
import { pick, toFieldErrors, type FormState } from "@/lib/form";

// ─── helpers ──────────────────────────────────────────────────────────────────

function yymm(now: Date) {
  return `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─── sellAccessory ────────────────────────────────────────────────────────────

const sellAccessorySchema = z.object({
  stockItemId: z.string().min(1),
  itemId: z.string().min(1),
  itemName: z.string().min(1),
  unitPricePaise: z.coerce.number().int().positive(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .regex(/^\d{10,15}$/, "Phone must be 10–15 digits"),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "OTHER"]),
});

export async function sellAccessory(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionPermission(SALES_PATHS.direct, "canCreate");
  const scope = await getBranchScope(user);
  if (!scope.branchId) {
    return { ok: false, message: "Please select a branch before recording a sale." };
  }

  const raw = pick(formData, [
    "stockItemId",
    "itemId",
    "itemName",
    "unitPricePaise",
    "customerName",
    "customerPhone",
    "quantity",
    "paymentMode",
  ]);
  const parsed = sellAccessorySchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { stockItemId, itemId, itemName, unitPricePaise, customerName, customerPhone, quantity, paymentMode } =
    parsed.data;
  const totalPaise = unitPricePaise * quantity;

  // Verify stock availability
  const stock = await db.stockItem.findFirst({
    where: { id: stockItemId, branchId: scope.branchId },
    select: { id: true, quantity: true },
  });
  if (!stock) return { ok: false, message: "Stock item not found." };
  if (stock.quantity < quantity) {
    return { ok: false, message: `Only ${stock.quantity} unit(s) available in stock.` };
  }

  const branch = await db.branch.findUnique({
    where: { id: scope.branchId },
    select: { code: true },
  });
  if (!branch) return { ok: false, message: "Branch not found." };

  const mm = yymm(new Date());
  const seqKey = `DIRECT_SALE:${branch.code}:${mm}`;

  await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, seqKey);
    const saleNo = `DS-${branch.code}-${mm}-${String(seq).padStart(4, "0")}`;

    await tx.directSale.create({
      data: {
        saleNo,
        branchId: scope.branchId!,
        customerName,
        customerPhone,
        paymentMode,
        totalPaise,
        soldById: user.id,
        items: {
          create: { itemId, itemName, quantity, unitPricePaise, totalPaise },
        },
      },
    });

    await tx.stockItem.update({
      where: { id: stockItemId },
      data: { quantity: { decrement: quantity } },
    });
  });

  revalidatePath(SALES_PATHS.direct);
  return { ok: true, message: "Sale recorded successfully." };
}

// ─── sellRefurbItem ───────────────────────────────────────────────────────────

const sellRefurbSchema = z.object({
  refurbItemId: z.string().min(1),
  salePricePaise: z.coerce.number().int().positive(),
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .regex(/^\d{10,15}$/, "Phone must be 10–15 digits"),
  paymentMode: z.enum(["CASH", "UPI", "CARD", "OTHER"]),
});

export async function sellRefurbItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionPermission(SALES_PATHS.direct, "canCreate");
  const scope = await getBranchScope(user);
  if (!scope.branchId) {
    return { ok: false, message: "Please select a branch before recording a sale." };
  }

  const raw = pick(formData, ["refurbItemId", "salePricePaise", "customerName", "customerPhone", "paymentMode"]);
  const parsed = sellRefurbSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { refurbItemId, salePricePaise, customerName, customerPhone, paymentMode } = parsed.data;

  const refurbItem = await db.refurbItem.findFirst({
    where: { id: refurbItemId, branchId: scope.branchId, status: "AVAILABLE", isActive: true },
    select: { id: true, name: true },
  });
  if (!refurbItem) return { ok: false, message: "Refurb item not found or already sold." };

  const branch = await db.branch.findUnique({
    where: { id: scope.branchId },
    select: { code: true },
  });
  if (!branch) return { ok: false, message: "Branch not found." };

  const mm = yymm(new Date());
  const seqKey = `DIRECT_SALE:${branch.code}:${mm}`;

  await db.$transaction(async (tx) => {
    const seq = await nextSequence(tx, seqKey);
    const saleNo = `DS-${branch.code}-${mm}-${String(seq).padStart(4, "0")}`;

    await tx.directSale.create({
      data: {
        saleNo,
        branchId: scope.branchId!,
        customerName,
        customerPhone,
        paymentMode,
        totalPaise: salePricePaise,
        soldById: user.id,
      },
    });

    await tx.refurbItem.update({
      where: { id: refurbItemId },
      data: { status: "SOLD" },
    });
  });

  revalidatePath(SALES_PATHS.direct);
  return { ok: true, message: "Refurb device sold successfully." };
}

// ─── addRefurbItem ────────────────────────────────────────────────────────────

const addRefurbSchema = z.object({
  name: z.string().trim().min(1, "Device name is required"),
  brand: z.string().trim().min(1, "Brand is required"),
  specs: z.string().trim().min(1, "Specs are required"),
  grade: z.enum(["A", "B", "C"]),
  // Form sends paise values via hidden inputs (visible inputs are rupees, onChange converts)
  costPaise: z.coerce.number().int().positive("Cost must be a positive number"),
  sellingPricePaise: z.coerce.number().int().positive("Selling price must be a positive number"),
  warrantyMonths: z.coerce.number().int().min(0).default(36),
  serialNo: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function addRefurbItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionPermission(SALES_PATHS.direct, "canCreate");
  const scope = await getBranchScope(user);
  if (!scope.branchId) {
    return { ok: false, message: "Please select a branch first." };
  }

  const raw = pick(formData, [
    "name",
    "brand",
    "specs",
    "grade",
    "costPaise",
    "sellingPricePaise",
    "warrantyMonths",
    "serialNo",
  ]);
  const parsed = addRefurbSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { name, brand, specs, grade, costPaise, sellingPricePaise, warrantyMonths, serialNo } = parsed.data;

  await db.refurbItem.create({
    data: {
      branchId: scope.branchId,
      name,
      brand,
      specs,
      grade,
      costPaise,
      sellingPricePaise,
      warrantyMonths,
      serialNo,
    },
  });

  revalidatePath(SALES_PATHS.direct);
  return { ok: true, message: "Device added to refurb stock." };
}

// ─── recordBuyback ────────────────────────────────────────────────────────────

const recordBuybackSchema = z.object({
  customerName: z.string().trim().min(1, "Customer name is required"),
  customerPhone: z
    .string()
    .trim()
    .min(10, "Enter a valid phone number")
    .regex(/^\d{10,15}$/, "Phone must be 10–15 digits"),
  deviceName: z.string().trim().min(1, "Device name is required"),
  brand: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  deviceModel: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  condition: z.enum(["WORKING", "PARTIAL", "NOT_WORKING"]),
  // Form sends paise via hidden input (visible input is rupees, onChange converts)
  agreedPricePaise: z.coerce.number().int().positive("Agreed price must be a positive number"),
  notes: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function recordBuyback(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireActionPermission(SALES_PATHS.direct, "canCreate");
  const scope = await getBranchScope(user);
  if (!scope.branchId) {
    return { ok: false, message: "Please select a branch first." };
  }

  const raw = pick(formData, [
    "customerName",
    "customerPhone",
    "deviceName",
    "brand",
    "deviceModel",
    "condition",
    "agreedPricePaise",
    "notes",
  ]);
  const parsed = recordBuybackSchema.safeParse(raw);
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  const { customerName, customerPhone, deviceName, brand, deviceModel, condition, agreedPricePaise, notes } =
    parsed.data;

  await db.buybackRecord.create({
    data: {
      branchId: scope.branchId,
      customerName,
      customerPhone,
      deviceName,
      brand,
      deviceModel,
      condition,
      agreedPricePaise,
      notes,
      recordedById: user.id,
    },
  });

  revalidatePath(SALES_PATHS.direct);
  return { ok: true, message: "Buyback recorded successfully." };
}
