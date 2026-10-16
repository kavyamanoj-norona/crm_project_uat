-- AlterEnum
ALTER TYPE "PaymentMode" ADD VALUE 'BANK_TRANSFER';

-- AlterTable
ALTER TABLE "payment" ADD COLUMN     "invoiceId" TEXT;

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "case_invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "gstInclusive" BOOLEAN NOT NULL DEFAULT true,
    "subtotalPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "BillPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "case_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_invoice_line" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "itemId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "gstPercent" INTEGER NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "lineTotalPaise" INTEGER NOT NULL,
    "addedAtBilling" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "case_invoice_line_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note" (
    "id" TEXT NOT NULL,
    "noteNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "refundMode" "PaymentMode",
    "refundPaise" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "credit_note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "subType" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry" (
    "id" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "entryDate" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "branchId" TEXT,
    "narration" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "reversalOfId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "journal_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_line" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "debitPaise" INTEGER NOT NULL DEFAULT 0,
    "creditPaise" INTEGER NOT NULL DEFAULT 0,
    "partyType" TEXT,
    "partyId" TEXT,
    "memo" TEXT,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "journal_line_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_invoice_invoiceNo_key" ON "case_invoice"("invoiceNo");
CREATE UNIQUE INDEX "case_invoice_caseId_key" ON "case_invoice"("caseId");
CREATE INDEX "case_invoice_branchId_issuedAt_idx" ON "case_invoice"("branchId", "issuedAt");
CREATE INDEX "case_invoice_customerId_idx" ON "case_invoice"("customerId");
CREATE INDEX "case_invoice_line_invoiceId_idx" ON "case_invoice_line"("invoiceId");
CREATE UNIQUE INDEX "credit_note_noteNo_key" ON "credit_note"("noteNo");
CREATE INDEX "credit_note_invoiceId_idx" ON "credit_note"("invoiceId");
CREATE UNIQUE INDEX "account_code_key" ON "account"("code");
CREATE UNIQUE INDEX "journal_entry_entryNo_key" ON "journal_entry"("entryNo");
CREATE INDEX "journal_entry_entryDate_idx" ON "journal_entry"("entryDate");
CREATE INDEX "journal_entry_branchId_entryDate_idx" ON "journal_entry"("branchId", "entryDate");
CREATE UNIQUE INDEX "journal_entry_sourceType_sourceId_key" ON "journal_entry"("sourceType", "sourceId");
CREATE INDEX "journal_line_accountId_branchId_idx" ON "journal_line"("accountId", "branchId");
CREATE INDEX "journal_line_entryId_idx" ON "journal_line"("entryId");
CREATE INDEX "journal_line_partyType_partyId_idx" ON "journal_line"("partyType", "partyId");

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "case_invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "case_invoice" ADD CONSTRAINT "case_invoice_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_invoice" ADD CONSTRAINT "case_invoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_invoice" ADD CONSTRAINT "case_invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_invoice_line" ADD CONSTRAINT "case_invoice_line_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "case_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "credit_note" ADD CONSTRAINT "credit_note_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "case_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "journal_line" ADD CONSTRAINT "journal_line_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Chart of accounts (system accounts are posted to automatically)
INSERT INTO "account" ("id", "code", "name", "type", "subType", "isSystem") VALUES
  (gen_random_uuid()::text, '1000', 'Cash in Hand', 'ASSET', 'CASH', true),
  (gen_random_uuid()::text, '1010', 'Bank & Digital Payments', 'ASSET', 'BANK', true),
  (gen_random_uuid()::text, '1100', 'Accounts Receivable (Customers)', 'ASSET', 'RECEIVABLE', true),
  (gen_random_uuid()::text, '1200', 'Inventory (Spare Parts & Accessories)', 'ASSET', 'INVENTORY', true),
  (gen_random_uuid()::text, '1300', 'GST Input Credit', 'ASSET', 'GST_INPUT', true),
  (gen_random_uuid()::text, '1400', 'Inter-branch Account', 'ASSET', 'INTERBRANCH', true),
  (gen_random_uuid()::text, '2000', 'Accounts Payable (Suppliers)', 'LIABILITY', 'PAYABLE', true),
  (gen_random_uuid()::text, '2100', 'GST Output Payable', 'LIABILITY', 'GST_OUTPUT', true),
  (gen_random_uuid()::text, '2200', 'Customer Advances', 'LIABILITY', 'ADVANCE', true),
  (gen_random_uuid()::text, '3000', 'Owner''s Equity', 'EQUITY', 'EQUITY', true),
  (gen_random_uuid()::text, '4000', 'Service Income', 'INCOME', 'SERVICE_INCOME', true),
  (gen_random_uuid()::text, '4050', 'Spare Parts Income', 'INCOME', 'PARTS_INCOME', true),
  (gen_random_uuid()::text, '4100', 'Product & Accessory Sales', 'INCOME', 'SALES_INCOME', true),
  (gen_random_uuid()::text, '4200', 'Sales Returns & Credit Notes', 'INCOME', 'SALES_RETURNS', true),
  (gen_random_uuid()::text, '5000', 'Cost of Goods Sold', 'EXPENSE', 'COGS', true),
  (gen_random_uuid()::text, '5100', 'Salaries & Wages', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5110', 'Rent', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5120', 'Utilities (Electricity, Internet)', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5130', 'Courier & Freight', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5140', 'Marketing & Advertising', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5150', 'Repairs & Maintenance', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5190', 'Other Expenses', 'EXPENSE', 'EXPENSE', false),
  (gen_random_uuid()::text, '5900', 'Round-off', 'EXPENSE', 'ROUND_OFF', true);
