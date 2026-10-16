"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { branchWhere, getBranchScope } from "@/server/branch-scope";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import { nextSequence } from "@/server/sequence";
import type { ActionResult, FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { parseRupees } from "@/modules/inventory/billing-schema";
import { ACCT, LedgerError, payAccount, postJournal, reverseJournal } from "./ledger";
import { FINANCE_PATHS } from "./paths";
import { postCasePayment, postPurchasePayment } from "./posting";
import { postMissingEntries } from "./sync";

const MODES = ["CASH", "UPI", "CARD", "BANK_TRANSFER"] as const;
type Mode = (typeof MODES)[number];

const fail = (field: string, message: string): FormState => ({ message, fieldErrors: { [field]: [message] } });
const text = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);
const mode = (fd: FormData): Mode | null => ((MODES as readonly string[]).includes(String(fd.get("mode"))) ? (String(fd.get("mode")) as Mode) : null);
const money = (fd: FormData, k: string) => parseRupees(text(fd, k, 20)) ?? 0;

function refresh() {
  revalidatePath("/finance", "layout");
}

const periodFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", year: "2-digit", month: "2-digit" });
const period = () => periodFmt.formatToParts(new Date()).reduce((s, p) => (p.type === "year" || p.type === "month" ? s + p.value : s), "");

/** Wraps an action body: permission errors and ledger / field errors become form messages. */
async function guard(run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LedgerError) return { message: e.message };
    if (e instanceof FieldError) return fail(e.field, e.message);
    throw e;
  }
}

/** Collect a later payment against an invoice that was closed with a due. */
export async function collectInvoicePayment(invoiceId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const m = mode(fd);
    const amount = money(fd, "amount");
    if (!m) return fail("mode", "Select the payment mode");
    if (amount <= 0) return fail("amount", "Enter the amount received");
    const user = await requireActionPermission(FINANCE_PATHS.invoices, "canEdit");
    const scope = branchWhere(await getBranchScope(user));
    const reference = text(fd, "reference", 60) || null;

    const result = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "case_invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
      const inv = await tx.caseInvoice.findFirst({ where: { id: invoiceId, ...scope }, select: { id: true, invoiceNo: true, branchId: true, customerId: true, caseId: true, totalPaise: true, paidPaise: true, creditedPaise: true } });
      if (!inv) throw new FieldError("amount", "Invoice not found");
      const due = inv.totalPaise - inv.creditedPaise - inv.paidPaise;
      if (amount > due) throw new FieldError("amount", `Only ${formatPaise(due)} is still due`);
      const pay = await tx.payment.create({
        data: { branchId: inv.branchId, caseId: inv.caseId, customerId: inv.customerId, kind: "OTHER", mode: m, amountPaise: amount, reference, receivedById: user.id, invoiceId: inv.id },
        include: { case: { select: { jobsheetNo: true } } },
      });
      await postCasePayment(tx, pay, user.id);
      const paid = inv.paidPaise + amount;
      await tx.caseInvoice.update({ where: { id: inv.id }, data: { paidPaise: paid, paymentStatus: paid + inv.creditedPaise >= inv.totalPaise ? "PAID" : "PARTIAL" } });
      return inv.invoiceNo;
    });
    await logActivity({ action: "finance.collect", userId: user.id, entity: "CaseInvoice", entityId: invoiceId, detail: `${formatPaise(amount)} received (${m}) against ${result}` });
    refresh();
    return { ok: true, message: `${formatPaise(amount)} received.` };
  });
}

/** Pay a supplier against a purchase bill (Dr Accounts Payable, Cr Cash/Bank). */
export async function paySupplierBill(billId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const m = mode(fd);
    const amount = money(fd, "amount");
    if (!m) return fail("mode", "Select the payment mode");
    if (amount <= 0) return fail("amount", "Enter the amount paid");
    const user = await requireActionPermission(FINANCE_PATHS.payables, "canEdit");

    const billNo = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "purchase_bill" WHERE "id" = ${billId} FOR UPDATE`;
      const bill = await tx.purchaseBill.findUnique({ where: { id: billId }, select: { id: true, billNo: true, branchId: true, supplierId: true, totalPaise: true, paidPaise: true } });
      if (!bill) throw new FieldError("amount", "Bill not found");
      const due = bill.totalPaise - bill.paidPaise;
      if (amount > due) throw new FieldError("amount", `Only ${formatPaise(due)} is still due`);
      const pay = await tx.purchaseBillPayment.create({ data: { billId, amountPaise: amount, mode: m, referenceNo: text(fd, "reference", 60) || null, createdById: user.id } });
      await postPurchasePayment(tx, pay, bill, user.id);
      const paid = bill.paidPaise + amount;
      await tx.purchaseBill.update({ where: { id: billId }, data: { paidPaise: paid, paymentStatus: paid >= bill.totalPaise ? "PAID" : "PARTIAL" } });
      return bill.billNo;
    });
    await logActivity({ action: "finance.supplier-payment", userId: user.id, entity: "PurchaseBill", entityId: billId, detail: `${formatPaise(amount)} paid (${m}) for bill ${billNo}` });
    revalidatePath("/inventory/billing", "layout");
    refresh();
    return { ok: true, message: `${formatPaise(amount)} paid.` };
  });
}

/** Record a business expense (Dr expense account, Cr Cash/Bank) for a branch. */
export async function addExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const m = mode(fd);
    const amount = money(fd, "amount");
    const accountId = text(fd, "accountId", 40);
    const date = text(fd, "date", 10);
    if (!accountId) return fail("accountId", "Select the expense category");
    if (!m) return fail("mode", "Select the payment mode");
    if (amount <= 0) return fail("amount", "Enter the amount");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("date", "Enter the date");
    const user = await requireActionPermission(FINANCE_PATHS.expenses, "canCreate");
    const scope = await getBranchScope(user);
    const branchId = scope.branchId ?? (text(fd, "branchId", 40) || null);
    if (!branchId) return fail("branchId", "Select the branch");
    const account = await db.account.findFirst({ where: { id: accountId, type: "EXPENSE", isActive: true }, select: { code: true, name: true } });
    if (!account) return fail("accountId", "Select a valid expense category");

    const entry = await db.$transaction((tx) =>
      postJournal(tx, {
        sourceType: "EXPENSE",
        sourceId: randomUUID(),
        branchId,
        date: new Date(`${date}T12:00:00+05:30`),
        userId: user.id,
        narration: `${account.name}${text(fd, "remarks") ? `: ${text(fd, "remarks")}` : ""} (${m})`,
        lines: [
          { account: account.code, branchId, debit: amount },
          { account: payAccount(m), branchId, credit: amount },
        ],
      }),
    );
    await logActivity({ action: "finance.expense", userId: user.id, entity: "JournalEntry", entityId: entry.id, detail: `${entry.entryNo}: expense ${formatPaise(amount)} (${account.name})` });
    refresh();
    return { ok: true, message: `Expense recorded (${entry.entryNo}).` };
  });
}

/** Move money between branches (or to Head Office). Each side balances through the inter-branch account. */
export async function addTransfer(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const m = mode(fd);
    const amount = money(fd, "amount");
    const from = text(fd, "fromBranchId", 40);
    const to = text(fd, "toBranchId", 40);
    if (!from) return fail("fromBranchId", "Select the sending branch");
    if (!to) return fail("toBranchId", "Select the receiving branch");
    if (from === to) return fail("toBranchId", "Choose a different branch");
    if (!m) return fail("mode", "Select cash or bank");
    if (amount <= 0) return fail("amount", "Enter the amount");
    const user = await requireActionPermission(FINANCE_PATHS.transfers, "canCreate");

    const entry = await db.$transaction(async (tx) => {
      const [a, b] = await Promise.all([tx.branch.findUnique({ where: { id: from }, select: { code: true } }), tx.branch.findUnique({ where: { id: to }, select: { code: true } })]);
      if (!a || !b) throw new FieldError("toBranchId", "Branch not found");
      return postJournal(tx, {
        sourceType: "TRANSFER",
        sourceId: randomUUID(),
        branchId: from,
        userId: user.id,
        narration: `Transfer ${a.code} → ${b.code} (${m})${text(fd, "remarks") ? `: ${text(fd, "remarks")}` : ""}`,
        lines: [
          { account: ACCT.INTERBRANCH, branchId: from, debit: amount, memo: `Due from ${b.code}` },
          { account: payAccount(m), branchId: from, credit: amount },
          { account: payAccount(m), branchId: to, debit: amount },
          { account: ACCT.INTERBRANCH, branchId: to, credit: amount, memo: `Due to ${a.code}` },
        ],
      });
    });
    await logActivity({ action: "finance.transfer", userId: user.id, entity: "JournalEntry", entityId: entry.id, detail: `${entry.entryNo}: ${formatPaise(amount)} moved between branches (${m})` });
    refresh();
    return { ok: true, message: `Transfer recorded (${entry.entryNo}).` };
  });
}

/** A manual journal entry (adjustments, opening balances). It must balance in total and within each branch. */
export async function addManualJournal(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    let rows: { accountId: string; branchId: string; debit: string; credit: string }[];
    try {
      rows = JSON.parse(String(fd.get("lines") ?? "[]"));
    } catch {
      return { message: "Something went wrong reading the lines." };
    }
    const narration = text(fd, "narration");
    const date = text(fd, "date", 10);
    if (narration.length < 3) return fail("narration", "Enter a narration");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("date", "Enter the date");
    const user = await requireActionPermission(FINANCE_PATHS.journal, "canCreate");
    const accounts = await db.account.findMany({ where: { id: { in: rows.map((r) => r.accountId) }, isActive: true }, select: { id: true, code: true } });
    const code = new Map(accounts.map((a) => [a.id, a.code]));
    const lines = rows.map((r) => {
      const c = code.get(r.accountId);
      if (!c || !r.branchId) throw new FieldError("lines", "Every line needs an account and a branch");
      return { account: c, branchId: r.branchId, debit: parseRupees(r.debit) ?? 0, credit: parseRupees(r.credit) ?? 0 };
    });
    const entry = await db.$transaction((tx) =>
      postJournal(tx, { sourceType: "MANUAL", sourceId: randomUUID(), branchId: lines[0]?.branchId, date: new Date(`${date}T12:00:00+05:30`), userId: user.id, narration, lines }),
    );
    await logActivity({ action: "finance.journal", userId: user.id, entity: "JournalEntry", entityId: entry.id, detail: `${entry.entryNo}: manual entry — ${narration}` });
    refresh();
    return { ok: true, message: `Entry posted (${entry.entryNo}).` };
  });
}

/** Correct a posted entry by posting its mirror image; the original is kept. */
export async function reverseEntry(entryId: string, _prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const reason = text(fd, "reason");
    if (reason.length < 3) return fail("reason", "Enter the reason");
    const user = await requireActionPermission(FINANCE_PATHS.journal, "canEdit");
    const rev = await db.$transaction((tx) => reverseJournal(tx, entryId, user.id, reason));
    await logActivity({ action: "finance.reversal", userId: user.id, entity: "JournalEntry", entityId: entryId, detail: `Reversed by ${rev.entryNo}: ${reason}` });
    refresh();
    return { ok: true, message: `Reversed (${rev.entryNo}).` };
  });
}

/**
 * A credit note against an invoice (return, price correction): the invoice due drops by the credited amount. Any part above
 * the current due has already been paid, so it is refunded in cash or bank. Income and GST are reduced in proportion.
 */
export async function addCreditNote(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const invoiceId = text(fd, "invoiceId", 40);
    const amount = money(fd, "amount");
    const reason = text(fd, "reason");
    if (!invoiceId) return fail("invoiceId", "Select the invoice");
    if (amount <= 0) return fail("amount", "Enter the credit amount");
    if (reason.length < 3) return fail("reason", "Enter the reason");
    const user = await requireActionPermission(FINANCE_PATHS.creditNotes, "canCreate");
    const scope = branchWhere(await getBranchScope(user));
    const m = mode(fd);

    const note = await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "case_invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
      const inv = await tx.caseInvoice.findFirst({ where: { id: invoiceId, ...scope }, select: { id: true, invoiceNo: true, branchId: true, customerId: true, totalPaise: true, taxPaise: true, paidPaise: true, creditedPaise: true, branch: { select: { code: true } } } });
      if (!inv) throw new FieldError("invoiceId", "Invoice not found");
      const remainingCreditable = inv.totalPaise - inv.creditedPaise;
      if (amount > remainingCreditable) throw new FieldError("amount", `At most ${formatPaise(remainingCreditable)} can still be credited`);
      const due = inv.totalPaise - inv.creditedPaise - inv.paidPaise;
      const refund = Math.max(0, amount - Math.max(0, due));
      if (refund > 0 && !m) throw new FieldError("mode", `${formatPaise(refund)} was already paid: choose how it is refunded`);

      const tax = Math.round((inv.taxPaise * amount) / inv.totalPaise);
      const seq = await nextSequence(tx, `CN:${inv.branch.code}:${period()}`);
      const noteNo = `CN-${inv.branch.code.toUpperCase()}-${period()}-${String(seq).padStart(3, "0")}`;
      const created = await tx.creditNote.create({ data: { noteNo, invoiceId, amountPaise: amount, taxPaise: tax, reason, refundMode: refund > 0 ? m : null, refundPaise: refund, createdById: user.id } });
      await postJournal(tx, {
        sourceType: "CREDIT_NOTE",
        sourceId: created.id,
        branchId: inv.branchId,
        userId: user.id,
        narration: `Credit note ${noteNo} against ${inv.invoiceNo}: ${reason}`,
        lines: [
          { account: ACCT.SALES_RETURNS, branchId: inv.branchId, debit: amount - tax },
          { account: ACCT.GST_OUTPUT, branchId: inv.branchId, debit: tax },
          { account: ACCT.RECEIVABLE, branchId: inv.branchId, credit: amount - refund, partyType: "CUSTOMER", partyId: inv.customerId },
          ...(refund > 0 && m ? [{ account: payAccount(m), branchId: inv.branchId, credit: refund }] : []),
        ],
      });
      const credited = inv.creditedPaise + amount;
      const paid = inv.paidPaise - refund;
      await tx.caseInvoice.update({ where: { id: inv.id }, data: { creditedPaise: credited, paidPaise: paid, paymentStatus: paid + credited >= inv.totalPaise ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID" } });
      return { noteNo, refund };
    });
    await logActivity({ action: "finance.credit-note", userId: user.id, entity: "CaseInvoice", entityId: invoiceId, detail: `${note.noteNo}: ${formatPaise(amount)} credited — ${reason}${note.refund > 0 ? ` (refunded ${formatPaise(note.refund)})` : ""}` });
    refresh();
    return { ok: true, message: `Credit note ${note.noteNo} created.` };
  });
}

/** Post every record that is not in the ledger yet (safe to run any number of times). */
export async function postMissing(): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(FINANCE_PATHS.reconciliation, "canEdit");
    const done = await postMissingEntries(user.id);
    const total = Object.values(done).reduce((s, n) => s + n, 0);
    await logActivity({ action: "finance.sync", userId: user.id, entity: "Ledger", detail: `Posted ${total} missing entries: ${JSON.stringify(done)}` });
    refresh();
    return { ok: true, message: total === 0 ? "Everything is already in the ledger." : `Posted ${total} missing entries.` };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LedgerError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Add an account to the chart (for example a new expense head). System accounts cannot be changed. */
export async function addAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const code = text(fd, "code", 8);
    const name = text(fd, "name", 80);
    const type = text(fd, "type", 12);
    if (!/^\d{4}$/.test(code)) return fail("code", "Use a 4-digit account code");
    if (name.length < 3) return fail("name", "Enter the account name");
    if (!["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(type)) return fail("type", "Select the account type");
    const user = await requireActionPermission(FINANCE_PATHS.accounts, "canCreate");
    if (await db.account.findFirst({ where: { code } })) return fail("code", "This code is already used");
    const acc = await db.account.create({ data: { code, name, type: type as "ASSET", subType: type === "EXPENSE" ? "EXPENSE" : null } });
    await logActivity({ action: "finance.account", userId: user.id, entity: "Account", entityId: acc.id, detail: `Account ${code} ${name} (${type}) added` });
    refresh();
    return { ok: true, message: `Account ${code} added.` };
  });
}
