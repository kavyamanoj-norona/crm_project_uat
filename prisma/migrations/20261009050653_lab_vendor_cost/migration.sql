-- AlterTable
ALTER TABLE "case_item" ADD COLUMN     "vendorCostPaise" INTEGER;

-- CreateTable
CREATE TABLE "chip_lab_vendor_payment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "note" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidById" TEXT,

    CONSTRAINT "chip_lab_vendor_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chip_lab_vendor_payment_caseId_idx" ON "chip_lab_vendor_payment"("caseId");

-- AddForeignKey
ALTER TABLE "chip_lab_vendor_payment" ADD CONSTRAINT "chip_lab_vendor_payment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip_lab_vendor_payment" ADD CONSTRAINT "chip_lab_vendor_payment_paidById_fkey" FOREIGN KEY ("paidById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
