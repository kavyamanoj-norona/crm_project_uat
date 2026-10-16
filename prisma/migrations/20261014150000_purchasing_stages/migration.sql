-- AlterEnum
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'ORDERED';
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'TRANSFERRED';
ALTER TYPE "StockUnitStatus" ADD VALUE 'CONSUMED';
ALTER TYPE "StockUnitAction" ADD VALUE 'CONSUMED';

-- AlterTable
ALTER TABLE "purchase_request" ADD COLUMN     "orderedAt" TIMESTAMPTZ,
ADD COLUMN     "orderedById" TEXT,
ADD COLUMN     "transferredAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "stock_unit" ADD COLUMN     "consumedAt" TIMESTAMPTZ,
ADD COLUMN     "consumedById" TEXT;

-- AddForeignKey
ALTER TABLE "stock_unit" ADD CONSTRAINT "stock_unit_consumedById_fkey" FOREIGN KEY ("consumedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
