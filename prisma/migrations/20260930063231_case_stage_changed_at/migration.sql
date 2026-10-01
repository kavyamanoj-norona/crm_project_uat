-- AlterTable
ALTER TABLE "service_case" ADD COLUMN     "stageChangedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "service_case_branchId_stageChangedAt_idx" ON "service_case"("branchId", "stageChangedAt");
