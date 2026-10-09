-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('CUSTOMER', 'LEAD');

-- AlterEnum
ALTER TYPE "LeadSource" ADD VALUE 'WEBSITE';

-- AlterTable
ALTER TABLE "customer" ADD COLUMN     "convertedAt" TIMESTAMPTZ,
ADD COLUMN     "convertedById" TEXT,
ADD COLUMN     "kind" "CustomerKind" NOT NULL DEFAULT 'CUSTOMER',
ADD COLUMN     "leadCode" TEXT,
ADD COLUMN     "purpose" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "customer_leadCode_key" ON "customer"("leadCode");

-- CreateIndex
CREATE INDEX "customer_kind_createdAt_idx" ON "customer"("kind", "createdAt");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_convertedById_fkey" FOREIGN KEY ("convertedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

