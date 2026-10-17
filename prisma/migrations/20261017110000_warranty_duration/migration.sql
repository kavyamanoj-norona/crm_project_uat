-- CreateEnum
CREATE TYPE "WarrantyUnit" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- AlterTable: warranty periods are now a number plus a unit (days, weeks, months, years)
ALTER TABLE "warranty" ADD COLUMN "durationValue" INTEGER,
ADD COLUMN "durationUnit" "WarrantyUnit";

UPDATE "warranty" SET
  "durationUnit" = CASE WHEN "months" % 12 = 0 THEN 'YEAR'::"WarrantyUnit" ELSE 'MONTH'::"WarrantyUnit" END,
  "durationValue" = CASE WHEN "months" % 12 = 0 THEN "months" / 12 ELSE "months" END;

ALTER TABLE "warranty" ALTER COLUMN "durationValue" SET NOT NULL,
ALTER COLUMN "durationUnit" SET NOT NULL;

DROP INDEX IF EXISTS "warranty_months_idx";
ALTER TABLE "warranty" DROP COLUMN "months";

-- AlterTable: units keep the warranty's label instead of a month count
ALTER TABLE "stock_unit" ADD COLUMN "warrantyLabel" TEXT;
UPDATE "stock_unit" u SET "warrantyLabel" = w."name" FROM "warranty" w WHERE u."warrantyId" = w."id";
ALTER TABLE "stock_unit" DROP COLUMN "warrantyMonths";
