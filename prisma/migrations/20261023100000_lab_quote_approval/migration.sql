-- AlterEnum
ALTER TYPE "ApprovalRequestStatus" ADD VALUE 'SENT';

-- CreateEnum
CREATE TYPE "ApprovalRequestKind" AS ENUM ('MANUAL_APPROVAL', 'LAB_QUOTE');

-- AlterTable
ALTER TABLE "service_case" ADD COLUMN "chipBaselinePaise" INTEGER;

-- AlterTable
ALTER TABLE "case_approval_request" ADD COLUMN "kind" "ApprovalRequestKind" NOT NULL DEFAULT 'MANUAL_APPROVAL',
ADD COLUMN "baselinePaise" INTEGER,
ADD COLUMN "sendRemarks" TEXT,
ADD COLUMN "sentById" TEXT,
ADD COLUMN "sentAt" TIMESTAMPTZ;

-- DropIndex
DROP INDEX "case_approval_request_branchId_idx";

-- CreateIndex
CREATE INDEX "case_approval_request_branchId_kind_status_idx" ON "case_approval_request"("branchId", "kind", "status");

-- AddForeignKey
ALTER TABLE "case_approval_request" ADD CONSTRAINT "case_approval_request_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
