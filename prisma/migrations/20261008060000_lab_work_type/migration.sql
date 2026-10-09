-- AlterTable: add lab work type fields to service_case
ALTER TABLE "service_case" ADD COLUMN "labWorkType" TEXT;
ALTER TABLE "service_case" ADD COLUMN "labEngineerId" TEXT;
ALTER TABLE "service_case" ADD COLUMN "labVendorId" TEXT;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_labEngineerId_fkey" FOREIGN KEY ("labEngineerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_labVendorId_fkey" FOREIGN KEY ("labVendorId") REFERENCES "chip_lab_vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "service_case_labEngineerId_idx" ON "service_case"("labEngineerId");
CREATE INDEX "service_case_labVendorId_idx" ON "service_case"("labVendorId");
