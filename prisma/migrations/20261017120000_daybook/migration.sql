-- CreateEnum
CREATE TYPE "CashbookKind" AS ENUM ('EXPENSE', 'DEPOSIT');

-- CreateTable
CREATE TABLE "cashbook_entry" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "CashbookKind" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "remarks" TEXT,
    "receiptUrl" TEXT,
    "journalEntryId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "cashbook_entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "day_close" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "crmBalancePaise" INTEGER NOT NULL,
    "physicalPaise" INTEGER NOT NULL,
    "variancePaise" INTEGER NOT NULL,
    "remarks" TEXT,
    "varianceEntryId" TEXT,
    "closedById" TEXT,
    "closedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "day_close_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cashbook_entry_journalEntryId_key" ON "cashbook_entry"("journalEntryId");

-- CreateIndex
CREATE INDEX "cashbook_entry_branchId_date_idx" ON "cashbook_entry"("branchId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "day_close_varianceEntryId_key" ON "day_close"("varianceEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "day_close_branchId_date_key" ON "day_close"("branchId", "date");

-- AddForeignKey
ALTER TABLE "cashbook_entry" ADD CONSTRAINT "cashbook_entry_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entry" ADD CONSTRAINT "cashbook_entry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entry" ADD CONSTRAINT "cashbook_entry_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbook_entry" ADD CONSTRAINT "cashbook_entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_close" ADD CONSTRAINT "day_close_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_close" ADD CONSTRAINT "day_close_varianceEntryId_fkey" FOREIGN KEY ("varianceEntryId") REFERENCES "journal_entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "day_close" ADD CONSTRAINT "day_close_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

