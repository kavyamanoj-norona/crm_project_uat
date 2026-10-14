-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED');

-- AlterTable
ALTER TABLE "case_attachment" ADD COLUMN     "returnId" TEXT;

-- CreateTable
CREATE TABLE "case_item_return" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "caseItemId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_item_return_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_item_return_caseId_idx" ON "case_item_return"("caseId");

-- CreateIndex
CREATE INDEX "case_item_return_caseItemId_status_idx" ON "case_item_return"("caseItemId", "status");

-- CreateIndex
CREATE INDEX "case_attachment_returnId_idx" ON "case_attachment"("returnId");

-- AddForeignKey
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "case_item_return"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item_return" ADD CONSTRAINT "case_item_return_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item_return" ADD CONSTRAINT "case_item_return_caseItemId_fkey" FOREIGN KEY ("caseItemId") REFERENCES "case_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item_return" ADD CONSTRAINT "case_item_return_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
