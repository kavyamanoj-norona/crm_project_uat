-- AlterTable
ALTER TABLE "stock_unit" ADD COLUMN     "returnReceivedAt" TIMESTAMPTZ,
ADD COLUMN     "returnReceivedById" TEXT;
