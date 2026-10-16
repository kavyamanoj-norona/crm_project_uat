-- AlterEnum
ALTER TYPE "PurchaseRequestStatus" ADD VALUE 'SPARE_UNAVAILABLE';

-- AlterTable
ALTER TABLE "purchase_request" ADD COLUMN     "pmRemarks" TEXT;
