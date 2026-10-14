-- CreateEnum
CREATE TYPE "StockUnitStatus" AS ENUM ('AVAILABLE', 'ALLOCATED');

-- CreateTable
CREATE TABLE "stock_unit" (
    "id" TEXT NOT NULL,
    "usid" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "billItemId" TEXT,
    "branchId" TEXT NOT NULL,
    "status" "StockUnitStatus" NOT NULL DEFAULT 'AVAILABLE',
    "allocatedAt" TIMESTAMPTZ,
    "allocatedById" TEXT,
    "allocatedCaseId" TEXT,
    "allocatedBranchId" TEXT,
    "purchaseRequestId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,
    "caseItemReturnId" TEXT,

    CONSTRAINT "stock_unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_unit_usid_key" ON "stock_unit"("usid");

-- CreateIndex
CREATE INDEX "stock_unit_status_itemId_idx" ON "stock_unit"("status", "itemId");

-- CreateIndex
CREATE INDEX "stock_unit_branchId_status_idx" ON "stock_unit"("branchId", "status");

-- CreateIndex
CREATE INDEX "stock_unit_allocatedCaseId_idx" ON "stock_unit"("allocatedCaseId");

-- CreateIndex
CREATE INDEX "stock_unit_billItemId_idx" ON "stock_unit"("billItemId");

-- CreateIndex
CREATE INDEX "stock_unit_purchaseRequestId_idx" ON "stock_unit"("purchaseRequestId");

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "purchase_bill_item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_allocatedById_fkey" FOREIGN KEY ("allocatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_allocatedCaseId_fkey" FOREIGN KEY ("allocatedCaseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_allocatedBranchId_fkey" FOREIGN KEY ("allocatedBranchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_caseItemReturnId_fkey" FOREIGN KEY ("caseItemReturnId") REFERENCES "case_item_return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Backfill: turn existing lots and consumptions into one record per unit ───────────────────────

-- 1. One available unit for every unit on every saved bill line. The unit USID is the old lot USID plus a suffix.
INSERT INTO "stock_unit" ("id", "usid", "itemId", "billItemId", "branchId", "status", "createdAt")
SELECT 'su_' || bi."id" || '_' || lpad(g::text, 5, '0'),
       bi."usid" || '-' || lpad(g::text, 2, '0'),
       bi."itemId", bi."id", b."branchId", 'AVAILABLE', bi."createdAt"
FROM "purchase_bill_item" bi
JOIN "purchase_bill" b ON b."id" = bi."billId",
     generate_series(1, bi."quantity") AS g;

-- 2. Units already consumed from a billed lot become ALLOCATED, oldest consumption first.
WITH expanded AS (
  SELECT a."billItemId", a."caseId", a."purchaseRequestId", a."createdById", a."createdAt", a."note",
         row_number() OVER (PARTITION BY a."billItemId" ORDER BY a."createdAt", a."id", g) AS rn
  FROM "stock_allocation" a, generate_series(1, a."quantity") AS g
  WHERE a."billItemId" IS NOT NULL
)
UPDATE "stock_unit" u
SET "status" = 'ALLOCATED',
    "allocatedAt" = e."createdAt",
    "allocatedById" = e."createdById",
    "allocatedCaseId" = e."caseId",
    "allocatedBranchId" = (SELECT c."branchId" FROM "service_case" c WHERE c."id" = e."caseId"),
    "purchaseRequestId" = e."purchaseRequestId",
    "note" = e."note"
FROM expanded e
WHERE u."billItemId" = e."billItemId"
  AND u."usid" = (SELECT bi."usid" FROM "purchase_bill_item" bi WHERE bi."id" = e."billItemId") || '-' || lpad(e.rn::text, 2, '0');

-- 3. Consumptions of stock that had no bill become allocated units with no bill line.
INSERT INTO "stock_unit" ("id", "usid", "itemId", "billItemId", "branchId", "status", "allocatedAt", "allocatedById",
                          "allocatedCaseId", "allocatedBranchId", "purchaseRequestId", "note", "createdAt")
SELECT 'su_' || a."id" || '_' || lpad(g::text, 5, '0'),
       a."usid" || '-' || lpad(g::text, 2, '0'),
       a."itemId", NULL, a."branchId", 'ALLOCATED', a."createdAt", a."createdById", a."caseId",
       (SELECT c."branchId" FROM "service_case" c WHERE c."id" = a."caseId"),
       a."purchaseRequestId", a."note", a."createdAt"
FROM "stock_allocation" a, generate_series(1, a."quantity") AS g
WHERE a."billItemId" IS NULL;


-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_billItemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_branchId_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_caseId_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_itemId_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_purchaseRequestId_fkey";

-- DropForeignKey
ALTER TABLE "stock_allocation" DROP CONSTRAINT "stock_allocation_requestedItemId_fkey";

-- DropIndex
DROP INDEX "purchase_bill_item_usid_key";

-- AlterTable
ALTER TABLE "purchase_bill_item" DROP COLUMN "consumedQty",
DROP COLUMN "usid";

-- DropTable
DROP TABLE "stock_allocation";
