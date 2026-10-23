
-- CreateEnum
CREATE TYPE "ApprovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "case_approval_request" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "status" "ApprovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "quoteAmountPaise" INTEGER NOT NULL,
    "requestNote" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedById" TEXT,
    "reviewRemarks" TEXT,
    "reviewedAt" TIMESTAMPTZ,

    CONSTRAINT "case_approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_approval_request_caseId_requestedAt_idx" ON "case_approval_request"("caseId", "requestedAt");

-- CreateIndex
CREATE INDEX "case_approval_request_status_requestedAt_idx" ON "case_approval_request"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "case_approval_request_branchId_idx" ON "case_approval_request"("branchId");

-- AddForeignKey
ALTER TABLE "case_approval_request" ADD CONSTRAINT "case_approval_request_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approval_request" ADD CONSTRAINT "case_approval_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_approval_request" ADD CONSTRAINT "case_approval_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

