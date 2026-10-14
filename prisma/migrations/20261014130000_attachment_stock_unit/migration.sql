-- AlterTable
ALTER TABLE "case_attachment" ADD COLUMN     "stockUnitId" TEXT;

-- CreateIndex
CREATE INDEX "case_attachment_stockUnitId_idx" ON "case_attachment"("stockUnitId");

-- AddForeignKey
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "stock_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
