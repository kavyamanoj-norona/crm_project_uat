-- AlterTable
ALTER TABLE "service_case" ADD COLUMN "chipRequirements" TEXT,
ADD COLUMN "chipMaxEstimatePaise" INTEGER,
ADD COLUMN "chipDeadRisk" BOOLEAN NOT NULL DEFAULT false;
