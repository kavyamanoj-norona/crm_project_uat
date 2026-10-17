"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { db, type Tx } from "@/server/db";
import { getBranchScope } from "@/server/branch-scope";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { parseRupees } from "@/modules/inventory/billing-schema";
import { getHeadOfficeBranch } from "@/modules/inventory/head-office";
import { ACCT, LedgerError, postJournal } from "./ledger";
import { cashBalanceBefore, dayValue, isDateString, istDay, todayIst } from "./daybook";
import { FINANCE_PATHS } from "./paths";

const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

const fail = (field: string, message: string): FormState => ({ message, fieldErrors: { [field]: [message] } });
const text = (fd: FormData, k: string, max = 300) => String(fd.get(k) ?? "").trim().slice(0, max);

async function guard(run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LedgerError) return { message: e.message };
    if (e instanceof FieldError) return fail(e.field, e.message);
    throw e;
  }
}

/** The branch the Daybook works on: a branch user's own, or the one picked in the header. Never "all branches". */
async function daybookBranch(permission: "canCreate" | "canEdit") {
  const user = await requireActionPermission(FINANCE_PATHS.daybook, permission);
  const scope = await getBranchScope(user);
  if (!scope.branchId) throw new FieldError("form", "Select a branch in the header first.");
  return { user, branchId: scope.branchId };
}

/** The optional receipt (image or PDF): checked, then stored. Returns its URL, or null when none was added. */
async function saveReceipt(fd: FormData, branchId: string): Promise<string | null> {
  const file = fd.getAll("receipt").find((f): f is File => f instanceof File && f.size > 0);
  if (!file) return null;
  const ext = RECEIPT_TYPES[file.type];
  if (!ext) throw new FieldError("receipt", "Use a JPG, PNG or WebP photo, or a PDF");
  if (file.size > RECEIPT_MAX_BYTES) throw new FieldError("receipt", "The receipt is larger than 5 MB");
  // TODO: move to S3 with the other uploads (blueprint §13).
  const dir = path.join(process.cwd(), "public", "uploads", "cashbook", branchId);
  await mkdir(dir, { recursive: true });
  const name = `${Date.now()}-${randomUUID().slice(0, 8)}.${ext}`;
  await writeFile(path.join(dir, name), Buffer.from(await file.arrayBuffer()));
  return `/uploads/cashbook/${branchId}/${name}`;
}

/** A closed day is read-only: nothing more can be posted to it. Checked inside the posting transaction. */
async function assertDayOpen(tx: Tx, branchId: string, date: string) {
  const closed = await tx.dayClose.findUnique({ where: { branchId_date: { branchId, date: dayValue(date) } }, select: { id: true } });
  if (closed) throw new FieldError("form", "This day is already reconciled and closed. Corrections go through a reversal by Finance.");
}

function refresh() {
  revalidatePath(FINANCE_PATHS.daybook);
  revalidatePath("/finance", "layout");
}

/** Add expense (cash out): Dr the expense account, Cr Cash in Hand, today, at this branch. */
export async function postDaybookExpense(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const description = text(fd, "description", 150);
    const accountId = text(fd, "accountId", 40);
    const amount = parseRupees(text(fd, "amount", 20));
    if (description.length < 3) return fail("description", "Enter what the expense was for");
    if (!accountId) return fail("accountId", "Select the category");
    if (amount === null || amount <= 0) return fail("amount", "Enter the amount");

    const { user, branchId } = await daybookBranch("canCreate");
    const account = await db.account.findFirst({ where: { id: accountId, type: "EXPENSE", subType: "EXPENSE", isActive: true }, select: { code: true, name: true } });
    if (!account) return fail("accountId", "Select a valid category");
    const date = todayIst();
    if (amount > (await cashBalanceBefore(branchId, new Date()))) return fail("amount", "There isn't that much cash in the box");
    const receiptUrl = await saveReceipt(fd, branchId);

    const entry = await db.$transaction(async (tx) => {
      await assertDayOpen(tx, branchId, date);
      const je = await postJournal(tx, {
        sourceType: "EXPENSE",
        sourceId: randomUUID(),
        branchId,
        userId: user.id,
        narration: `Expense — ${description} · ${account.name} (CASH)`,
        lines: [
          { account: account.code, branchId, debit: amount },
          { account: ACCT.CASH, branchId, credit: amount },
        ],
      });
      await tx.cashbookEntry.create({
        data: { branchId, date: dayValue(date), kind: "EXPENSE", amountPaise: amount, description, accountId, receiptUrl, journalEntryId: je.id, createdById: user.id },
      });
      return je;
    });
    await logActivity({ action: "finance.daybook.expense", userId: user.id, entity: "JournalEntry", entityId: entry.id, detail: `${entry.entryNo}: ${description} ${formatPaise(amount)} (${account.name})${receiptUrl ? " · receipt" : ""}` });
    refresh();
    return { ok: true, message: `Expense of ${formatPaise(amount)} posted (${entry.entryNo}).` };
  });
}

/**
 * Deposit cash to a Head Office bank account. It is a transfer, not income or expense: the branch's Cash in Hand goes
 * down and the Head Office bank goes up, through the inter-branch account so each branch's books still balance.
 */
export async function depositCashToBank(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const accountId = text(fd, "bankAccountId", 40);
    const amount = parseRupees(text(fd, "amount", 20));
    const remarks = text(fd, "remarks", 300) || null;
    if (!accountId) return fail("bankAccountId", "Select the bank account");
    if (amount === null || amount <= 0) return fail("amount", "Enter the amount deposited");

    const { user, branchId } = await daybookBranch("canCreate");
    const bank = await db.account.findFirst({ where: { id: accountId, type: "ASSET", subType: "BANK", isActive: true }, select: { code: true, name: true } });
    if (!bank) return fail("bankAccountId", "Select a valid bank account");
    const date = todayIst();
    if (amount > (await cashBalanceBefore(branchId, new Date()))) return fail("amount", "There isn't that much cash in the box");
    const [ho, branch] = await Promise.all([getHeadOfficeBranch(), db.branch.findUniqueOrThrow({ where: { id: branchId }, select: { code: true } })]);
    const receiptUrl = await saveReceipt(fd, branchId);

    const entry = await db.$transaction(async (tx) => {
      await assertDayOpen(tx, branchId, date);
      const lines =
        ho.id === branchId
          ? [
              { account: bank.code, branchId, debit: amount },
              { account: ACCT.CASH, branchId, credit: amount },
            ]
          : [
              { account: ACCT.INTERBRANCH, branchId, debit: amount, memo: `Deposited to HO ${bank.name}` },
              { account: ACCT.CASH, branchId, credit: amount },
              { account: bank.code, branchId: ho.id, debit: amount },
              { account: ACCT.INTERBRANCH, branchId: ho.id, credit: amount, memo: `Cash deposit from ${branch.code}` },
            ];
      const je = await postJournal(tx, {
        sourceType: "CASH_DEPOSIT",
        sourceId: randomUUID(),
        branchId,
        userId: user.id,
        narration: `Cash deposit ${branch.code} → ${bank.name}${remarks ? `: ${remarks}` : ""}`,
        lines,
      });
      await tx.cashbookEntry.create({
        data: { branchId, date: dayValue(date), kind: "DEPOSIT", amountPaise: amount, description: `Deposit to ${bank.name}`, accountId, remarks, receiptUrl, journalEntryId: je.id, createdById: user.id },
      });
      return je;
    });
    await logActivity({ action: "finance.daybook.deposit", userId: user.id, entity: "JournalEntry", entityId: entry.id, detail: `${entry.entryNo}: ${formatPaise(amount)} cash deposited from ${branch.code} to ${bank.name}${remarks ? ` — ${remarks}` : ""}` });
    refresh();
    return { ok: true, message: `${formatPaise(amount)} deposited to ${bank.name} (${entry.entryNo}).` };
  });
}

/**
 * Reconcile & Close: the cash counted is checked against the CRM balance the user saw (it must not have changed since),
 * any difference is booked (short → Other Expenses, over → back to Other Expenses as a credit) so the books match the box,
 * and the day is closed. A closed day is read-only and can't be closed twice.
 */
export async function closeDaybook(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const date = text(fd, "date", 10);
    const physical = parseRupees(text(fd, "physical", 20));
    const expected = Number(text(fd, "expectedBalance", 20));
    const remarks = text(fd, "remarks", 300) || null;
    if (!isDateString(date) || date > todayIst()) return fail("form", "Pick a valid day to close.");
    if (physical === null || text(fd, "physical", 20) === "") return fail("physical", "Enter the cash counted in the box");
    if (fd.get("confirmed") !== "yes") return fail("form", "Confirm the closing first.");

    const { user, branchId } = await daybookBranch("canEdit");
    const { to } = istDay(date);
    const isToday = date === todayIst();

    const result = await db.$transaction(async (tx) => {
      // One close per branch per day, even if two people press the button together.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`dayclose:${branchId}:${date}`}))`;
      await assertDayOpen(tx, branchId, date);
      const cash = await tx.account.findUniqueOrThrow({ where: { code: ACCT.CASH }, select: { id: true } });
      const s = await tx.journalLine.aggregate({
        where: { accountId: cash.id, branchId, entry: { entryDate: { lt: isToday ? new Date(Date.now() + 1000) : to } } },
        _sum: { debitPaise: true, creditPaise: true },
      });
      const crm = (s._sum.debitPaise ?? 0) - (s._sum.creditPaise ?? 0);
      if (Number.isFinite(expected) && expected !== crm)
        throw new FieldError("form", `The CRM balance changed to ${formatPaise(crm)} while you were counting. Check it and close again.`);
      const variance = physical - crm;
      if (variance !== 0 && !remarks) throw new FieldError("remarks", "Explain the difference between the count and the CRM balance");

      let varianceEntryId: string | null = null;
      if (variance !== 0) {
        const je = await postJournal(tx, {
          sourceType: "CASH_VARIANCE",
          sourceId: `${branchId}:${date}`,
          branchId,
          userId: user.id,
          // Booked on the day being closed, so its closing balance equals the cash counted.
          date: isToday ? new Date() : new Date(to.getTime() - 1000),
          narration: `Cash ${variance < 0 ? "short" : "over"} at day close ${date}: ${remarks}`,
          lines:
            variance < 0
              ? [
                  { account: ACCT.OTHER_EXPENSE, branchId, debit: -variance },
                  { account: ACCT.CASH, branchId, credit: -variance },
                ]
              : [
                  { account: ACCT.CASH, branchId, debit: variance },
                  { account: ACCT.OTHER_EXPENSE, branchId, credit: variance },
                ],
        });
        varianceEntryId = je.id;
      }
      await tx.dayClose.create({
        data: { branchId, date: dayValue(date), crmBalancePaise: crm, physicalPaise: physical, variancePaise: variance, remarks, varianceEntryId, closedById: user.id },
      });
      return { crm, variance };
    });

    await logActivity({
      action: "finance.daybook.close",
      userId: user.id,
      entity: "Branch",
      entityId: branchId,
      detail: `Day ${date} closed: CRM ${formatPaise(result.crm)}, counted ${formatPaise(physical)}${result.variance ? `, ${result.variance < 0 ? "short" : "over"} ${formatPaise(Math.abs(result.variance))} — ${remarks}` : ", matched"}`,
    });
    refresh();
    return { ok: true, message: `Day ${date} reconciled and closed.` };
  });
}
