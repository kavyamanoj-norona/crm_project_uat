-- CreateEnum
CREATE TYPE "TargetPeriod" AS ENUM ('DAILY', 'MONTHLY', 'YEARLY');

-- CreateTable
CREATE TABLE "sales_target" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "period" "TargetPeriod" NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER,
    "day" INTEGER,
    "targetPaise" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sales_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_target_branchId_period_year_idx" ON "sales_target"("branchId", "period", "year");

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_branchId_period_year_month_day_key" ON "sales_target"("branchId", "period", "year", "month", "day");

-- AddForeignKey
ALTER TABLE "sales_target" ADD CONSTRAINT "sales_target_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target" ADD CONSTRAINT "sales_target_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
