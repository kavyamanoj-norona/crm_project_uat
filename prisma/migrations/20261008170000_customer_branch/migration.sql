-- AlterTable
ALTER TABLE "customer" ADD COLUMN "branchId" TEXT;

-- Backfill: the creator's branch, else the branch of the customer's earliest case
UPDATE "customer" c
SET "branchId" = u."branchId"
FROM "user" u
WHERE c."createdById" = u."id" AND u."branchId" IS NOT NULL;

UPDATE "customer" c
SET "branchId" = (
  SELECT sc."branchId" FROM "service_case" sc
  WHERE sc."customerId" = c."id"
  ORDER BY sc."createdAt" ASC
  LIMIT 1
)
WHERE c."branchId" IS NULL;

-- CreateIndex
CREATE INDEX "customer_branchId_idx" ON "customer"("branchId");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
