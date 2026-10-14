-- AlterTable
ALTER TABLE "case_attachment" ADD COLUMN     "purchaseRequestId" TEXT;

-- CreateIndex
CREATE INDEX "case_attachment_purchaseRequestId_idx" ON "case_attachment"("purchaseRequestId");

-- AddForeignKey
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "purchase_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
