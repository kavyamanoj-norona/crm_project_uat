-- AlterEnum
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'CONSUMED';

-- AlterTable
ALTER TABLE "purchase_bill_item" ADD COLUMN     "consumedQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "usid" TEXT;

-- Bill lines saved before USIDs existed get a legacy ID so the column can be required and unique.
UPDATE "purchase_bill_item" SET "usid" = 'USID-LEGACY-' || "id" WHERE "usid" IS NULL;
ALTER TABLE "purchase_bill_item" ALTER COLUMN "usid" SET NOT NULL;

-- AlterTable
ALTER TABLE "purchase_request" ADD COLUMN     "consumedQty" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "stock_allocation" (
    "id" TEXT NOT NULL,
    "usid" TEXT NOT NULL,
    "billItemId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "caseId" TEXT,
    "branchId" TEXT NOT NULL,
    "requestedItemId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_allocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_allocation_usid_idx" ON "stock_allocation"("usid");

-- CreateIndex
CREATE INDEX "stock_allocation_caseId_idx" ON "stock_allocation"("caseId");

-- CreateIndex
CREATE INDEX "stock_allocation_purchaseRequestId_idx" ON "stock_allocation"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "stock_allocation_billItemId_idx" ON "stock_allocation"("billItemId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_bill_item_usid_key" ON "purchase_bill_item"("usid");

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_billItemId_fkey" FOREIGN KEY ("billItemId") REFERENCES "purchase_bill_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_request"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_requestedItemId_fkey" FOREIGN KEY ("requestedItemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_allocation" ADD CONSTRAINT "stock_allocation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

