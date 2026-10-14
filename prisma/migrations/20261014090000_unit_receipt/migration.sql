-- CreateEnum
CREATE TYPE "StockUnitAction" AS ENUM ('ALLOCATED', 'RECEIVED');

-- AlterEnum
ALTER TYPE "StockUnitStatus" ADD VALUE 'RECEIVED';

-- AlterTable
ALTER TABLE "stock_unit" ADD COLUMN     "receivedAt" TIMESTAMPTZ,
ADD COLUMN     "receivedById" TEXT;

-- CreateTable
CREATE TABLE "stock_unit_event" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "action" "StockUnitAction" NOT NULL,
    "userId" TEXT,
    "caseId" TEXT,
    "branchId" TEXT,
    "note" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_unit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_unit_event_unitId_at_idx" ON "stock_unit_event"("unitId", "at");

-- CreateIndex
CREATE INDEX "stock_unit_event_caseId_idx" ON "stock_unit_event"("caseId");

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_event" ADD CONSTRAINT "stock_unit_event_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "stock_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_event" ADD CONSTRAINT "stock_unit_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_event" ADD CONSTRAINT "stock_unit_event_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit_event" ADD CONSTRAINT "stock_unit_event_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

