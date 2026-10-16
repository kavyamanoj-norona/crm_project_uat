"use server";

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getHeadOfficeBranch } from "../head-office";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { nextSequence } from "@/server/sequence";
import { pick, toFieldErrors, type FormState } from "@/lib/form";
import { scanBillImage } from "@/ai/bill-scanner";
import { INVENTORY_PATHS } from "../paths";
import {
  billPaymentSchema,
  billTotals,
  lineAmounts,
  normalizeBillNo,
  parseBill,
  type BillFormValues,
  type ScannedBill,
} from "../billing-schema";
import { findDuplicateBill, listBillableItems } from "../billing-queries";
import { issueUsids } from "../usid";
import { postPurchaseBill } from "@/modules/finance/posting";

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
// Only files this module saved can be attached to a bill.
const BILL_IMAGE_URL = /^\/uploads\/bills\/[a-f0-9]{64}\.(jpg|png|webp|pdf)$/;

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () =>
  periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

const emptyBill = (): ScannedBill => ({
  supplierName: "",
  supplierGstin: "",
  supplierState: "",
  supplierEmail: "",
  supplierPhone: "",
  supplierAddress: "",
  billNo: "",
  billDate: "",
  roundOff: "",
  total: "",
  lines: [],
});

export type ScanBillResult = {
  ok: boolean;
  /** Shown above the review form (scan notes) or as the error when ok is false. */
  message?: string;
  bill?: ScannedBill;
  imageUrl?: string;
  imageHash?: string;
  /** This bill (or this image) is already recorded. */
  duplicate?: { id: string; code: string; billNo: string; supplier: string };
};

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1));

/** Best catalog match for a printed description: the item code appears in it, or most words overlap. */
function matchItem(description: string, catalog: { id: string; code: string; name: string }[]) {
  const d = description.toLowerCase();
  const byCode = catalog.find((c) => c.code.length > 2 && d.includes(c.code.toLowerCase()));
  if (byCode) return byCode.id;
  const dw = words(description);
  if (dw.size === 0) return "";
  let best = { id: "", score: 0 };
  for (const c of catalog) {
    const cw = words(c.name);
    if (cw.size === 0) continue;
    let hit = 0;
    for (const w of cw) if (dw.has(w)) hit++;
    const score = hit / Math.max(cw.size, dw.size);
    if (score > best.score) best = { id: c.id, score };
  }
  return best.score >= 0.6 ? best.id : "";
}

/** Step 1: save the bill image, read it with AI, and return the details for the review form. */
export async function scanBill(formData: FormData): Promise<ScanBillResult> {
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.billing, "canCreate");

    const file = formData.get("bill");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Add a photo, image or PDF of the bill." };
    const ext = IMAGE_TYPES[file.type];
    if (!ext) return { ok: false, message: "Use a JPG, PNG or WebP image, or a PDF." };
    if (file.size > IMAGE_MAX_BYTES) return { ok: false, message: "The file is larger than 8 MB." };

    const bytes = Buffer.from(await file.arrayBuffer());
    const imageHash = createHash("sha256").update(bytes).digest("hex");

    const sameImage = await findDuplicateBill({ imageHash });
    if (sameImage) {
      return {
        ok: false,
        message: `This bill image is already recorded as ${sameImage.code}.`,
        duplicate: { id: sameImage.id, code: sameImage.code, billNo: sameImage.billNo, supplier: sameImage.supplier.name },
      };
    }

    // TODO: move to S3 with the other uploads (blueprint §13). Named by hash so a re-scan never adds a copy.
    const dir = path.join(process.cwd(), "public", "uploads", "bills");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${imageHash}.${ext}`), bytes);
    const imageUrl = `/uploads/bills/${imageHash}.${ext}`;

    let bill = emptyBill();
    let message: string | undefined;
    if (!process.env.OPENAI_API_KEY) {
      message = "Automatic scanning isn't set up (OPENAI_API_KEY is missing). Enter the bill details below.";
    } else {
      const startedAt = Date.now();
      try {
        const scanned = await scanBillImage({ bytes, mime: file.type });
        bill = scanned.bill;
        await db.aiAgentRun.create({
          data: {
            agentName: "bill-scanner",
            userId: user.id,
            question: `Scan bill ${imageHash.slice(0, 12)}`,
            answer: `${bill.lines.length} lines · ${bill.supplierName || "unknown supplier"} · ${bill.billNo || "no bill no"}`,
            tokensUsed: scanned.tokensUsed,
            durationMs: Date.now() - startedAt,
          },
        });
        message = "Scanned automatically. Check every field against the bill before confirming.";
      } catch (e) {
        await db.aiAgentRun.create({
          data: {
            agentName: "bill-scanner",
            userId: user.id,
            question: `Scan bill ${imageHash.slice(0, 12)}`,
            answer: "",
            error: String(e),
            durationMs: Date.now() - startedAt,
          },
        });
        message = "Couldn't read this bill automatically. Enter the details below, or go back and try a clearer photo.";
      }
    }

    const catalog = await listBillableItems();
    bill.lines = bill.lines.map((l) => ({ ...l, itemId: matchItem(l.description, catalog) }));

    const dup = await findDuplicateBill({ supplierGstin: bill.supplierGstin, supplierName: bill.supplierName, billNo: bill.billNo });
    if (dup) {
      return {
        ok: false,
        message: `Bill ${dup.billNo} from ${dup.supplier.name} is already recorded as ${dup.code}.`,
        duplicate: { id: dup.id, code: dup.code, billNo: dup.billNo, supplier: dup.supplier.name },
      };
    }

    return { ok: true, message, bill, imageUrl, imageHash };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

const isUnique = (e: unknown) => typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";

/** Step 2: save the reviewed bill, add its lines to branch stock and record the payment — all or nothing. */
export async function confirmBill(_prev: FormState, formData: FormData): Promise<FormState> {
  let values: BillFormValues;
  try {
    values = JSON.parse(String(formData.get("payload") ?? "")) as BillFormValues;
  } catch {
    return { message: "Something went wrong reading the form. Reload the page and try again." };
  }
  const { data, errors } = parseBill(values);
  if (!data) return { message: "Please fix the highlighted fields.", fieldErrors: errors };

  let billId: string;
  let supplierName: string;
  try {
    const user = await requireActionPermission(INVENTORY_PATHS.billing, "canCreate");
    // Purchase bills belong to the Head Office, whatever branch is selected in the header.
    const branch = await getHeadOfficeBranch();
    const branchId = branch.id;

    if (data.imageUrl && !BILL_IMAGE_URL.test(data.imageUrl)) throw new FieldError("form", "The bill image is invalid. Scan it again.");

    const itemIds = [...new Set(data.lines.filter((l) => !l.newItem).map((l) => l.itemId))];
    const items = await db.item.findMany({
      where: { id: { in: itemIds }, isActive: true, type: { not: "SERVICE" } },
      select: { id: true, name: true },
    });
    const known = new Set(items.map((i) => i.id));
    const itemName = new Map(items.map((i) => [i.id, i.name]));
    data.lines.forEach((l, i) => {
      if (!l.newItem && !known.has(l.itemId)) throw new FieldError(`lines.${i}.itemId`, "Select an active part or accessory. Services can’t be bought on a bill");
    });

    const lines = data.lines.map((l, i) => ({
      ...l,
      description: l.description ?? (l.newItem ? l.newName : itemName.get(l.itemId)) ?? "",
      ...lineAmounts(l.quantity, l.rate, l.gstPercent, l.discountAmt),
      sortOrder: i,
    }));
    const { subtotalPaise, taxPaise, totalPaise } = billTotals(lines, data.roundOff);
    const billNoNorm = normalizeBillNo(data.billNo);
    if (!billNoNorm) throw new FieldError("billNo", "Enter the bill number");

    const saved = await db.$transaction(async (tx) => {
      let supplier;
      if (data.supplierMode === "existing") {
        supplier = await tx.supplier.findFirst({ where: { id: data.supplierId!, isDelete: 0 } });
        if (!supplier) throw new FieldError("supplierId", "Select a supplier from the list");
        const fill = {
          ...(!supplier.phone && data.supplierPhone ? { phone: data.supplierPhone } : {}),
          ...(!supplier.address && data.supplierAddress ? { address: data.supplierAddress } : {}),
        };
        if (Object.keys(fill).length) await tx.supplier.update({ where: { id: supplier.id }, data: fill });
      } else {
        // A new supplier must not repeat one that exists: GSTIN is the identity when present, otherwise the name.
        const same = data.supplierGstin
          ? await tx.supplier.findUnique({ where: { gstin: data.supplierGstin } })
          : await tx.supplier.findFirst({ where: { name: { equals: data.supplierName, mode: "insensitive" }, isDelete: 0 } });
        if (same) {
          throw new FieldError(
            data.supplierGstin ? "supplierGstin" : "supplierName",
            `${same.name} is already a supplier. Select it from the list instead.`,
          );
        }
        supplier = await tx.supplier.create({
          data: {
            name: data.supplierName,
            gstin: data.supplierGstin,
            state: data.supplierState,
            phone: data.supplierPhone,
            email: data.supplierEmail,
            address: data.supplierAddress,
          },
        });
      }

      // New catalog items typed on the bill. Same name as an existing item is refused, so the catalog stays clean.
      const newItemId = new Map<number, string>();
      for (let i = 0; i < data.lines.length; i++) {
        const l = data.lines[i]!;
        if (!l.newItem) continue;
        const clash = await tx.item.findFirst({ where: { name: { equals: l.newName!, mode: "insensitive" }, isDelete: 0 }, select: { code: true } });
        if (clash) throw new FieldError(`lines.${i}.newName`, `${clash.code} already has this name. Select it from the list instead.`);
        const n = await nextSequence(tx, `ITEM:${l.newType}`);
        const created = await tx.item.create({
          data: {
            code: `${l.newType === "PART" ? "PRT" : "ACC"}-${String(n).padStart(5, "0")}`,
            name: l.newName!,
            type: l.newType,
            hsnSac: l.hsnSac,
            gstPercent: l.gstPercent,
            pricePaise: 0, // selling price is set later in the item catalog
            createdById: user.id,
            updatedById: user.id,
          },
          select: { id: true },
        });
        newItemId.set(i, created.id);
      }
      lines.forEach((l, i) => {
        const id = newItemId.get(i);
        if (id) l.itemId = id;
      });

      const dup = await tx.purchaseBill.findFirst({
        where: {
          OR: [{ supplierId: supplier.id, billNoNorm }, ...(data.imageHash ? [{ imageHash: data.imageHash }] : [])],
        },
        select: { code: true },
      });
      if (dup) throw new FieldError("billNo", `This bill is already recorded as ${dup.code}`);

      const seq = await nextSequence(tx, `PB:${branch.code}:${period()}`);
      const code = `PB-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
      const paid = data.paymentAmount;

      const bill = await tx.purchaseBill.create({
        data: {
          code,
          branchId,
          supplierId: supplier.id,
          billNo: data.billNo,
          billNoNorm,
          billDate: new Date(`${data.billDate}T00:00:00Z`),
          subtotalPaise,
          taxPaise,
          roundOffPaise: data.roundOff,
          totalPaise,
          paidPaise: paid,
          paymentStatus: paid === 0 ? "UNPAID" : paid >= totalPaise ? "PAID" : "PARTIAL",
          imageUrl: data.imageUrl,
          imageHash: data.imageHash,
          notes: data.notes,
          createdById: user.id,
          items: {
            create: lines.map((l) => ({
              itemId: l.itemId,
              description: l.description,
              hsnSac: l.hsnSac,
              quantity: l.quantity,
              unitCostPaise: l.rate,
              discountPaise: l.discountPaise,
              gstPercent: l.gstPercent,
              taxablePaise: l.taxablePaise,
              taxPaise: l.taxPaise,
              lineTotalPaise: l.lineTotalPaise,
              sortOrder: l.sortOrder,
            })),
          },
          ...(paid > 0 && data.paymentMode
            ? { payments: { create: { amountPaise: paid, mode: data.paymentMode, referenceNo: data.paymentRef, createdById: user.id } } }
            : {}),
        },
        select: { id: true, items: { select: { id: true, itemId: true, quantity: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } },
      });

      // One stock unit per purchased unit, each with the next sequential USID from the USID configuration
      // (issued inside this transaction, so a failed save hands the numbers back). The Purchase Manager later
      // allocates a specific USID to a case. The stock count below equals this unit count.
      const totalUnits = lines.reduce((n, l) => n + l.quantity, 0);
      const usids = await issueUsids(tx, totalUnits);
      let at = 0;
      const units = bill.items.flatMap((bi, idx) =>
        Array.from({ length: lines[idx]!.quantity }, () => ({ usid: usids[at++]!, itemId: bi.itemId, billItemId: bi.id, branchId })),
      );
      await tx.stockUnit.createMany({ data: units });
      // The bill and its ledger entry (Dr Inventory + GST Input, Cr Accounts Payable) are saved together.
      await postPurchaseBill(
        tx,
        { id: bill.id, code, branchId, supplierId: supplier.id, billNo: data.billNo, billDate: new Date(`${data.billDate}T00:00:00Z`), subtotalPaise, taxPaise, roundOffPaise: data.roundOff, totalPaise },
        user.id,
      );

      // Stock: add each item's total quantity (the same item can appear on several lines).
      const perItem = new Map<string, number>();
      for (const l of lines) perItem.set(l.itemId, (perItem.get(l.itemId) ?? 0) + l.quantity);
      for (const [itemId, qty] of perItem) {
        await tx.stockItem.upsert({
          where: { branchId_itemId: { branchId, itemId } },
          create: { branchId, itemId, quantity: qty, unitCodes: [], updatedById: user.id },
          update: { quantity: { increment: qty }, updatedById: user.id },
        });
      }
      return { id: bill.id, supplierName: supplier.name };
    });
    billId = saved.id;
    supplierName = saved.supplierName;

    await logActivity({
      action: "inventory.bill",
      userId: user.id,
      entity: "PurchaseBill",
      entityId: billId,
      detail: `Bill ${data.billNo} from ${supplierName}, ${lines.length} lines`,
    });
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    if (isUnique(e)) return { message: "This bill is already recorded.", fieldErrors: { billNo: ["This bill is already recorded"] } };
    throw e;
  }

  revalidatePath(INVENTORY_PATHS.billing);
  revalidatePath(INVENTORY_PATHS.stock);
  redirect(`${INVENTORY_PATHS.billing}/${billId}?saved=${Date.now()}`);
}

/** Records a further payment against a bill; never lets the total paid exceed the bill total. */
export async function addBillPayment(billId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = billPaymentSchema.safeParse(pick(formData, ["amount", "mode", "referenceNo", "note"]));
  if (!parsed.success) return toFieldErrors(parsed.error, formData);

  try {
    const user = await requireActionPermission(INVENTORY_PATHS.billing, "canEdit");
    const bill = await db.purchaseBill.findFirst({ where: { id: billId }, select: { id: true } });
    if (!bill) return { message: "Bill not found." };

    await db.$transaction(async (tx) => {
      // Lock the bill row so two payments at once can't both fit the same balance.
      await tx.$queryRaw`SELECT "id" FROM "purchase_bill" WHERE "id" = ${billId} FOR UPDATE`;
      const fresh = await tx.purchaseBill.findUniqueOrThrow({ where: { id: billId }, select: { totalPaise: true, paidPaise: true } });
      const balance = fresh.totalPaise - fresh.paidPaise;
      if (parsed.data.amount > balance) throw new FieldError("amount", `Only ₹${(balance / 100).toLocaleString("en-IN")} is still due`);

      await tx.purchaseBillPayment.create({
        data: { billId, amountPaise: parsed.data.amount, mode: parsed.data.mode, referenceNo: parsed.data.referenceNo, note: parsed.data.note, createdById: user.id },
      });
      const paid = fresh.paidPaise + parsed.data.amount;
      await tx.purchaseBill.update({
        where: { id: billId },
        data: { paidPaise: paid, paymentStatus: paid >= fresh.totalPaise ? "PAID" : "PARTIAL" },
      });
    });

    await logActivity({ action: "inventory.bill.payment", userId: user.id, entity: "PurchaseBill", entityId: billId, detail: `₹${parsed.data.amount / 100} paid` });
    revalidatePath(INVENTORY_PATHS.billing);
    revalidatePath(`${INVENTORY_PATHS.billing}/${billId}`);
    return { ok: true, message: "Payment recorded." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof FieldError) return { message: e.message, fieldErrors: { [e.field]: [e.message] } };
    throw e;
  }
}
