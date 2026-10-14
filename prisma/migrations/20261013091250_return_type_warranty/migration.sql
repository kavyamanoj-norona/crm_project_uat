-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('RETURN', 'WARRANTY_CLAIM');

-- AlterTable
ALTER TABLE "case_item_return" ADD COLUMN     "returnType" "ReturnType" NOT NULL DEFAULT 'RETURN',
ADD COLUMN     "reviewedAt" TIMESTAMPTZ,
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "warrantyEndsAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "case_item_return_returnType_status_idx" ON "case_item_return"("returnType", "status");

-- AddForeignKey
ALTER TABLE "case_item_return" ADD CONSTRAINT "case_item_return_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
