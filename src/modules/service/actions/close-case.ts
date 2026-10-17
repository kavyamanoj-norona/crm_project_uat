"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { nextSequence } from "@/server/sequence";
import type { FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { markCaseUnitsConsumed } from "@/modules/inventory/unit-consume";
import { postCaseInvoice, postCasePayment, postCogs } from "@/modules/finance/posting";
import { LedgerError } from "@/modules/finance/ledger";
import { CLOSING_PAYMENT_MODES, billSummary } from "../case-billing-math";
import { closeBlockReason, closingAccessories, closingBill } from "../case-billing";
import { SERVICE_PATHS } from "../paths";

const payloadSchema = z.object({
  accessories: z
    .array(z.object({ itemId: z.string().min(1), quantity: z.number().int().min(1).max(99), unitPricePaise: z.number().int().min(0), unitIds: z.array(z.string().min(1)).max(99).default([]) }))
    .max(20),
  payments: z
    .array(z.object({ mode: z.enum(CLOSING_PAYMENT_MODES), amountPaise: z.number().int().min(1), reference: z.string().trim().max(60) }))
    .max(6),
  notes: z.string().trim().max(300),
  acceptDue: z.boolean(),
});

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () => periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

class CloseError extends Error {}

/**
 * Closes a case with its final bill. In one transaction: the invoice and its lines are created, accessories added to the bill
 * leave branch stock, the payments taken now are recorded, the ledger entries are posted, and the case moves to Closed. Any
 * failed check rolls everything back, and a case can only ever have one invoice, so a double click cannot bill twice.
 */
export async function closeCaseWithBill(caseId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("payload") ?? ""));
  } catch {
    return { message: "Something went wrong reading the form. Reload the page and try again." };
  }
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) {
    const path = parsed.error.issues[0]?.path ?? [];
    if (path[0] === "payments" && path[2] === "mode") return { message: "Select a payment mode for each payment.", fieldErrors: { payments: ["Select a payment mode"] } };
    if (path[0] === "payments" && path[2] === "amountPaise") return { message: "Each payment needs an amount.", fieldErrors: { payments: ["Each payment needs an amount"] } };
    return { message: "Check the accessories and payments you entered." };
  }
  const input = parsed.data;

  try {
    const user = await requireActionPermission(SERVICE_PATHS.cases, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const visible = await db.case.findFirst({ where: { id: caseId, ...scope }, select: { id: true } });
    if (!visible) return { message: "Case not found." };

    const bill = await closingBill(caseId);
    if (!bill) return { message: "Case not found." };
    if (bill.invoiceNo) return { message: `This case is already billed (${bill.invoiceNo}).` };
    const blocked = await closeBlockReason(caseId, bill.status);
    if (blocked) return { message: blocked };

    // Accessories added to the bill: active, within the price range, and in stock at this branch.
    const catalog = new Map((await closingAccessories(bill.branchId)).map((a) => [a.id, a]));
    const added = input.accessories.map((a) => {
      const item = catalog.get(a.itemId);
      if (!item) throw new CloseError("An accessory is no longer available or is out of stock. Remove it and try again.");
      if (a.unitPricePaise < item.minPricePaise || a.unitPricePaise > item.pricePaise)
        throw new CloseError(`${item.name}: the price must be between ${formatPaise(item.minPricePaise)} and ${formatPaise(item.pricePaise)}.`);
      if (a.quantity > item.stock) throw new CloseError(`${item.name}: only ${item.stock} in stock.`);
      if (new Set(a.unitIds).size !== a.unitIds.length) throw new CloseError(`${item.name}: each USID can be picked once.`);
      if (a.unitIds.length > a.quantity) throw new CloseError(`${item.name}: more USIDs than the quantity billed.`);
      if (a.unitIds.some((id) => !item.units.some((u) => u.id === id))) throw new CloseError(`${item.name}: a selected USID is no longer available. Reselect and try again.`);
      if (a.quantity - a.unitIds.length > item.loose) throw new CloseError(`${item.name}: select a USID for each unit (only ${item.loose} in stock without a USID).`);
      return { item, ...a };
    });
    if (new Set(added.map((a) => a.itemId)).size !== added.length) throw new CloseError("Each accessory can be added once. Change its quantity instead.");

    const lines = [
      ...bill.lines.map((l) => ({ itemId: l.itemId as string | null, code: l.code, name: l.name, type: l.type, hsnSac: l.hsnSac, quantity: l.quantity, unitPricePaise: l.unitPricePaise, gstPercent: l.gstPercent, addedAtBilling: false })),
      ...added.map((a) => ({ itemId: a.itemId as string | null, code: a.item.code, name: a.item.name, type: "ACCESSORY", hsnSac: null as string | null, quantity: a.quantity, unitPricePaise: a.unitPricePaise, gstPercent: a.item.gstPercent, addedAtBilling: true })),
    ];
    if (lines.length === 0) throw new CloseError("There is nothing to bill on this case.");
    const sum = billSummary(lines, bill.gstInclusive);

    const advanceApplied = Math.min(bill.advancePaise, sum.totalPaise);
    const dueNow = sum.totalPaise - advanceApplied;
    const collected = input.payments.reduce((s, p) => s + p.amountPaise, 0);
    if (collected > dueNow) throw new CloseError(`The payments (${formatPaise(collected)}) are more than the amount due (${formatPaise(dueNow)}).`);
    const remaining = dueNow - collected;
    if (remaining > 0 && !input.acceptDue) throw new CloseError(`${formatPaise(remaining)} is still unpaid. Confirm that the case should close with an outstanding due.`);

    const branch = await db.branch.findUniqueOrThrow({ where: { id: bill.branchId }, select: { code: true } });
    const now = new Date();

    const result = await db.$transaction(async (tx) => {
      const seq = await nextSequence(tx, `INV:${branch.code}:${period()}`);
      const invoiceNo = `INV-${branch.code.toUpperCase()}-${period()}-${String(seq).padStart(4, "0")}`;
      const paid = advanceApplied + collected;

      const invoice = await tx.caseInvoice.create({
        data: {
          invoiceNo,
          caseId,
          branchId: bill.branchId,
          customerId: bill.customerId,
          gstInclusive: bill.gstInclusive,
          subtotalPaise: sum.taxablePaise,
          taxPaise: sum.taxPaise,
          totalPaise: sum.totalPaise,
          paidPaise: paid,
          paymentStatus: paid >= sum.totalPaise ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          notes: input.notes || null,
          issuedById: user.id,
          issuedAt: now,
          lines: {
            create: lines.map((l, i) => ({ ...l, taxablePaise: sum.amounts[i]!.taxablePaise, taxPaise: sum.amounts[i]!.taxPaise, lineTotalPaise: sum.amounts[i]!.lineTotalPaise, sortOrder: i })),
          },
        },
        select: { id: true, invoiceNo: true, branchId: true, customerId: true, totalPaise: true, taxPaise: true, issuedAt: true, lines: { select: { type: true, taxablePaise: true } } },
      });

      // Advances already taken: make sure each is in the ledger, then tie it to this invoice.
      const advances = await tx.payment.findMany({ where: { caseId, kind: "ADVANCE", invoiceId: null }, include: { case: { select: { jobsheetNo: true } } } });
      for (const a of advances) await postCasePayment(tx, a, user.id);
      await tx.payment.updateMany({ where: { caseId, kind: "ADVANCE", invoiceId: null }, data: { invoiceId: invoice.id } });

      await postCaseInvoice(tx, invoice, advanceApplied, user.id);

      // Payments collected now (several modes allowed): each is its own payment and ledger entry.
      for (const p of input.payments) {
        const pay = await tx.payment.create({
          data: { branchId: bill.branchId, caseId, customerId: bill.customerId, kind: "FINAL", mode: p.mode, amountPaise: p.amountPaise, reference: p.reference || null, receivedById: user.id, invoiceId: invoice.id },
          include: { case: { select: { jobsheetNo: true } } },
        });
        await postCasePayment(tx, pay, user.id);
      }

      // Accessories sold on the bill leave branch stock.
      for (const a of added) {
        const done = await tx.stockItem.updateMany({
          where: { branchId: bill.branchId, itemId: a.itemId, quantity: { gte: a.quantity } },
          data: { quantity: { decrement: a.quantity }, updatedById: user.id },
        });
        if (done.count === 0) throw new CloseError(`${a.item.name}: not enough stock.`);
        // The picked USIDs are consumed on this case (the stock count above already dropped for them).
        for (const unitId of a.unitIds) {
          const unit = await tx.stockUnit.findUnique({ where: { id: unitId }, select: { usid: true, branchId: true, billItem: { select: { taxablePaise: true, quantity: true } } } });
          const claimed = await tx.stockUnit.updateMany({
            where: { id: unitId, status: "RECEIVED", branchId: bill.branchId, itemId: a.itemId },
            data: { status: "CONSUMED", consumedAt: now, consumedById: user.id, allocatedCaseId: caseId },
          });
          if (!unit || claimed.count === 0) throw new CloseError(`${a.item.name}: a selected USID was just used by someone else. Reselect and try again.`);
          await tx.stockUnitEvent.create({ data: { unitId, action: "CONSUMED", userId: user.id, caseId, branchId: bill.branchId, note: `Sold on ${bill.jobsheetNo} (${invoiceNo})` } });
          if (unit.billItem && unit.billItem.quantity > 0) {
            await postCogs(tx, { unitId, usid: unit.usid, branchId: bill.branchId, costPaise: Math.round(unit.billItem.taxablePaise / unit.billItem.quantity), jobsheetNo: bill.jobsheetNo }, user.id);
          }
        }
      }

      // Close the case (only while it is still ready for delivery, so two people cannot both close it).
      const moved = await tx.case.updateMany({
        where: { id: caseId, status: "READY_FOR_DELIVERY" },
        data: { status: "CLOSED", stageChangedAt: now, updatedById: user.id },
      });
      if (moved.count === 0) throw new CloseError("Someone else changed this case just now. Refresh to see its current stage.");
      await tx.caseStatusHistory.create({
        data: { caseId, fromStatus: "READY_FOR_DELIVERY", toStatus: "CLOSED", note: `Invoice ${invoiceNo} · total ${formatPaise(sum.totalPaise)} · paid ${formatPaise(paid)}${remaining > 0 ? ` · due ${formatPaise(remaining)}` : ""}`, changedById: user.id },
      });
      await markCaseUnitsConsumed(tx, caseId, user.id);
      return { invoiceNo, remaining };
    });

    await logActivity({
      action: "case.close",
      userId: user.id,
      entity: "Case",
      entityId: caseId,
      detail: `${bill.jobsheetNo} closed. Invoice ${result.invoiceNo}, total ${formatPaise(sum.totalPaise)}, paid ${formatPaise(advanceApplied + collected)}${result.remaining > 0 ? `, due ${formatPaise(result.remaining)}` : ""}`,
    });
    revalidatePath(SERVICE_PATHS.cases, "layout");
    revalidatePath("/finance", "layout");
    revalidatePath("/inventory", "layout");
    return { ok: true, message: `Case closed. Invoice ${result.invoiceNo} generated${result.remaining > 0 ? `, ${formatPaise(result.remaining)} due` : ""}.` };
  } catch (e) {
    if (e instanceof ForbiddenError) return { message: e.message };
    if (e instanceof CloseError || e instanceof LedgerError) return { message: e.message };
    throw e;
  }
}
