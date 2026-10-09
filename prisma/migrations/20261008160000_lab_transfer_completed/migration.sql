-- AlterTable
ALTER TABLE "service_case" ADD COLUMN "labTransferCompletedAt" TIMESTAMPTZ;
ALTER TABLE "service_case" ADD COLUMN "labTransferCompletedById" TEXT;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_labTransferCompletedById_fkey" FOREIGN KEY ("labTransferCompletedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
