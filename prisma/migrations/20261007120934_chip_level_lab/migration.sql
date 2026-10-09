-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_TRANSFER';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_RECEIVED';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_DIAGNOSIS';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_PENDING_APPROVAL';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_SERVICING';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_LAB_READY_DISPATCH';
ALTER TYPE "CaseStatus" ADD VALUE 'CHIP_BRANCH_RECEIVED';
ALTER TYPE "CaseStatus" ADD VALUE 'NON_REPAIRABLE';

-- CreateTable
CREATE TABLE "chip_lab_vendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chip_lab_vendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chip_lab_outsource" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL,
    "expectedReturnAt" TIMESTAMPTZ,
    "actualReturnAt" TIMESTAMPTZ,
    "referenceNo" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chip_lab_outsource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chip_lab_vendor_isActive_idx" ON "chip_lab_vendor"("isActive");

-- CreateIndex
CREATE INDEX "chip_lab_outsource_caseId_idx" ON "chip_lab_outsource"("caseId");

-- AddForeignKey
ALTER TABLE "chip_lab_vendor" ADD CONSTRAINT "chip_lab_vendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip_lab_vendor" ADD CONSTRAINT "chip_lab_vendor_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip_lab_outsource" ADD CONSTRAINT "chip_lab_outsource_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip_lab_outsource" ADD CONSTRAINT "chip_lab_outsource_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "chip_lab_vendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chip_lab_outsource" ADD CONSTRAINT "chip_lab_outsource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
