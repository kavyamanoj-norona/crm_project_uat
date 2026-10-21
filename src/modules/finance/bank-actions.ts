"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { FieldError } from "@/server/prisma-errors";
import { ForbiddenError, requireActionPermission } from "@/server/rbac/guard";
import { logActivity } from "@/server/security/activity";
import type { ActionResult, FormState } from "@/lib/form";
import { formatPaise } from "@/lib/money";
import { getHeadOfficeBranch } from "@/modules/inventory/head-office";
import { parseRupees } from "@/modules/inventory/billing-schema";
import { ROUTABLE_MODES, MODE_LABEL, moveBankToHeadOffice, type RoutableMode } from "./bank";
import { DayLockError } from "./day-lock";
import { ACCT, LedgerError, postJournal } from "./ledger";
import { FINANCE_PATHS } from "./paths";
import { dayValue, isDateString, todayIst } from "./daybook";

const fail = (field: string, message: string): FormState => ({ message, fieldErrors: { [field]: [message] } });
const text = (fd: FormData, k: string, max = 120) => String(fd.get(k) ?? "").trim().slice(0, max);

const refresh = () => revalidatePath("/finance", "layout");

async function guard(run: () => Promise<FormState>): Promise<FormState> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LedgerError) return { message: e.message };
    if (e instanceof FieldError) return fail(e.field, e.message);
    throw e;
  }
}

/** Next free code for a bank account in the 1011–1099 range (1010 is the default bank account). */
async function nextBankCode(tx: Pick<typeof db, "account">) {
  const used = new Set((await tx.account.findMany({ where: { code: { gte: "1011", lte: "1099" } }, select: { code: true } })).map((a) => a.code));
  for (let n = 1011; n <= 1099; n++) if (!used.has(String(n))) return String(n);
  throw new FieldError("bankName", "No bank account codes are left (1011–1099).");
}

/**
 * A Head Office bank account: a chart account (what the ledger posts to) plus the bank details. A non-zero opening balance
 * is posted at Head Office against Owner's Equity, dated the opening date.
 */
export async function addBankAccount(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const bankName = text(fd, "bankName", 60);
    const accountHolder = text(fd, "accountHolder", 80) || null;
    const accountNumber = text(fd, "accountNumber", 24).replace(/\s+/g, "");
    const ifsc = text(fd, "ifsc", 11).toUpperCase() || null;
    const bankBranch = text(fd, "bankBranch", 80) || null;
    const openingText = text(fd, "opening", 20);
    const opening = openingText === "" ? 0 : parseRupees(openingText);
    const openingDate = text(fd, "openingDate", 10) || todayIst();

    if (bankName.length < 2) return fail("bankName", "Enter the bank name");
    if (!/^\d{6,20}$/.test(accountNumber)) return fail("accountNumber", "Enter the account number (6–20 digits)");
    if (ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return fail("ifsc", "Enter a valid IFSC code");
    if (opening === null || opening < 0) return fail("opening", "Enter the opening balance as an amount, or leave it blank");
    if (!isDateString(openingDate) || openingDate > todayIst()) return fail("openingDate", "Pick a date up to today");

    const user = await requireActionPermission(FINANCE_PATHS.cashBank, "canCreate");
    if (await db.bankAccount.findFirst({ where: { bankName: { equals: bankName, mode: "insensitive" }, accountNumber, isDelete: 0 }, select: { id: true } }))
      return fail("accountNumber", "This bank account is already added");

    const ho = await getHeadOfficeBranch();
    const result = await db.$transaction(async (tx) => {
      const code = await nextBankCode(tx);
      const account = await tx.account.create({ data: { code, name: `${bankName} ••${accountNumber.slice(-4)}`, type: "ASSET", subType: "BANK" } });
      const bank = await tx.bankAccount.create({
        data: { accountId: account.id, bankName, accountHolder, accountNumber, ifsc, bankBranch, openingPaise: opening, openingDate: dayValue(openingDate), createdById: user.id },
      });
      if (opening > 0) {
        await postJournal(tx, {
          sourceType: "OPENING_BALANCE",
          sourceId: bank.id,
          branchId: ho.id,
          date: new Date(`${openingDate}T00:00:00+05:30`),
          userId: user.id,
          narration: `Opening balance of ${account.name}`,
          lines: [
            { account: code, branchId: ho.id, debit: opening },
            { account: ACCT.EQUITY, branchId: ho.id, credit: opening },
          ],
        });
      }
      return { code, name: account.name };
    });
    await logActivity({ action: "finance.bank-account", userId: user.id, entity: "Account", detail: `Bank account ${result.code} ${result.name} added, opening ${formatPaise(opening)}` });
    refresh();
    return { ok: true, message: `Bank account ${result.code} added.` };
  });
}

/** Switch a bank account off (or back on). It must hold no money and have no routes first. */
export async function toggleBankAccount(accountId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(FINANCE_PATHS.cashBank, "canEdit");
    const acc = await db.account.findFirst({ where: { id: accountId, type: "ASSET", subType: "BANK" }, select: { id: true, code: true, name: true, isActive: true, bankAccount: { select: { id: true } } } });
    if (!acc) return { ok: false, message: "Bank account not found." };
    if (acc.isActive) {
      if (acc.code === ACCT.BANK) return { ok: false, message: "The default bank account can't be switched off." };
      const s = await db.journalLine.aggregate({ where: { accountId: acc.id }, _sum: { debitPaise: true, creditPaise: true } });
      if ((s._sum.debitPaise ?? 0) !== (s._sum.creditPaise ?? 0)) return { ok: false, message: "This account still holds money. Move it out first." };
      if (acc.bankAccount && (await db.paymentRoute.count({ where: { bankAccountId: acc.bankAccount.id, isActive: true, isDelete: 0 } })) > 0)
        return { ok: false, message: "Remove its payment routes first." };
    }
    await db.$transaction([
      db.account.update({ where: { id: acc.id }, data: { isActive: !acc.isActive } }),
      ...(acc.bankAccount ? [db.bankAccount.update({ where: { id: acc.bankAccount.id }, data: { isActive: !acc.isActive } })] : []),
    ]);
    await logActivity({ action: "finance.bank-account", userId: user.id, entity: "Account", entityId: acc.id, detail: `${acc.code} ${acc.name} ${acc.isActive ? "switched off" : "switched on"}` });
    refresh();
    return { ok: true, message: acc.isActive ? "Bank account switched off." : "Bank account switched on." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Send a payment mode (optionally for one branch, optionally for one UPI ID) into a bank account. Only new postings follow it. */
export async function addPaymentRoute(_prev: FormState, fd: FormData): Promise<FormState> {
  return guard(async () => {
    const mode = text(fd, "mode", 20) as RoutableMode;
    const branchId = text(fd, "branchId", 40) || null;
    const bankAccountId = text(fd, "bankAccountId", 40);
    const upiId = text(fd, "upiId", 60) || null;
    if (!(ROUTABLE_MODES as readonly string[]).includes(mode)) return fail("mode", "Select the payment mode");
    if (!bankAccountId) return fail("bankAccountId", "Select the bank account");
    if (upiId && mode !== "UPI") return fail("upiId", "A UPI ID only applies to UPI payments");
    if (upiId && !/^[\w.\-]{2,}@[A-Za-z]{2,}$/.test(upiId)) return fail("upiId", "Enter a valid UPI ID");

    const user = await requireActionPermission(FINANCE_PATHS.cashBank, "canCreate");
    const [bank, branch] = await Promise.all([
      db.bankAccount.findFirst({ where: { id: bankAccountId, isActive: true, isDelete: 0, account: { isActive: true } }, select: { id: true, bankName: true } }),
      branchId ? db.branch.findFirst({ where: { id: branchId, isActive: true }, select: { code: true } }) : Promise.resolve(null),
    ]);
    if (!bank) return fail("bankAccountId", "Select a bank account that is switched on");
    if (branchId && !branch) return fail("branchId", "Select a valid branch");
    const taken = await db.paymentRoute.findFirst({ where: { mode, branchId, isActive: true, isDelete: 0 }, select: { id: true } });
    if (taken) return fail("mode", `${MODE_LABEL[mode]} for ${branch?.code ?? "all branches"} already has a route. Remove it first.`);

    await db.paymentRoute.create({ data: { mode, branchId, upiId, bankAccountId: bank.id, createdById: user.id } });
    await logActivity({ action: "finance.payment-route", userId: user.id, entity: "PaymentRoute", detail: `${MODE_LABEL[mode]}${upiId ? ` (${upiId})` : ""} for ${branch?.code ?? "all branches"} → ${bank.bankName}` });
    refresh();
    return { ok: true, message: "Payment route added. New payments follow it." };
  });
}

/** Remove a route (kept as history, not deleted). Payments already posted stay where they were. */
export async function removePaymentRoute(routeId: string): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(FINANCE_PATHS.cashBank, "canEdit");
    const r = await db.paymentRoute.updateMany({ where: { id: routeId, isDelete: 0 }, data: { isActive: false, isDelete: 1 } });
    if (r.count === 0) return { ok: false, message: "Route not found." };
    await logActivity({ action: "finance.payment-route", userId: user.id, entity: "PaymentRoute", entityId: routeId, detail: "Route removed" });
    refresh();
    return { ok: true, message: "Route removed." };
  } catch (e) {
    if (e instanceof ForbiddenError) return { ok: false, message: e.message };
    throw e;
  }
}

/** Move bank money that earlier postings left on a branch to the Head Office bank. Safe to run any number of times. */
export async function moveBankMoney(): Promise<ActionResult> {
  try {
    const user = await requireActionPermission(FINANCE_PATHS.cashBank, "canEdit");
    const moved = await moveBankToHeadOffice(user.id);
    await logActivity({ action: "finance.bank-move", userId: user.id, entity: "Ledger", detail: `${moved} bank postings moved to the Head Office bank` });
    refresh();
    return { ok: true, message: moved === 0 ? "Nothing to move: the Head Office bank already holds everything." : `Moved ${moved} bank ${moved === 1 ? "posting" : "postings"} to the Head Office bank.` };
  } catch (e) {
    if (e instanceof ForbiddenError || e instanceof LedgerError || e instanceof DayLockError) return { ok: false, message: e.message };
    throw e;
  }
}
