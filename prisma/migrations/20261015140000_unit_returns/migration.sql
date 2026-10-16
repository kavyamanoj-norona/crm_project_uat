-- AlterEnum
ALTER TYPE "StockUnitStatus" ADD VALUE 'AWAITING_VENDOR';
ALTER TYPE "StockUnitAction" ADD VALUE 'REPLACED';

-- AlterTable
ALTER TABLE "stock_unit" ADD COLUMN     "returnType" TEXT,
ADD COLUMN     "returnRemarks" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMPTZ,
ADD COLUMN     "returnedById" TEXT;
