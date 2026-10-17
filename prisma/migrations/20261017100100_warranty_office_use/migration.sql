-- CreateTable
CREATE TABLE "warranty" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "months" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "warranty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "warranty_months_idx" ON "warranty"("months");

-- AlterTable
ALTER TABLE "purchase_bill" ADD COLUMN     "isOfficeUse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officePurpose" TEXT;

-- AlterTable
ALTER TABLE "purchase_bill_item" ADD COLUMN     "warrantyId" TEXT;

-- AlterTable
ALTER TABLE "stock_unit" ADD COLUMN     "isOfficeUse" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "officeEmployeeId" TEXT,
ADD COLUMN     "officeRemarks" TEXT,
ADD COLUMN     "warrantyId" TEXT,
ADD COLUMN     "warrantyMonths" INTEGER,
ADD COLUMN     "warrantyEndsAt" DATE;

-- CreateIndex
CREATE INDEX "stock_unit_isOfficeUse_status_idx" ON "stock_unit"("isOfficeUse", "status");

-- CreateIndex
CREATE INDEX "stock_unit_warrantyId_idx" ON "stock_unit"("warrantyId");

-- AddForeignKey
ALTER TABLE "purchase_bill_item" ADD CONSTRAINT "purchase_bill_item_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "warranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_warrantyId_fkey" FOREIGN KEY ("warrantyId") REFERENCES "warranty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_officeEmployeeId_fkey" FOREIGN KEY ("officeEmployeeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reusable warranty periods to start with.
INSERT INTO "warranty" ("id", "name", "months", "updatedAt") VALUES
  ('warranty-1m', '1 month', 1, CURRENT_TIMESTAMP),
  ('warranty-3m', '3 months', 3, CURRENT_TIMESTAMP),
  ('warranty-6m', '6 months', 6, CURRENT_TIMESTAMP),
  ('warranty-1y', '1 year', 12, CURRENT_TIMESTAMP),
  ('warranty-2y', '2 years', 24, CURRENT_TIMESTAMP);
