-- CreateEnum
CREATE TYPE "CaseItemUsageKind" AS ENUM ('CONSUMED', 'RETURNED_UNUSED', 'RETURNED_DEFECTIVE');

-- CreateTable
CREATE TABLE "case_item_usage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "kind" "CaseItemUsageKind" NOT NULL,
    "stockUnitId" TEXT,
    "reason" TEXT,
    "remarks" TEXT,
    "userId" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_item_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_item_usage_caseId_itemId_idx" ON "case_item_usage"("caseId", "itemId");

-- AddForeignKey
ALTER TABLE "case_item_usage" ADD CONSTRAINT "case_item_usage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item_usage" ADD CONSTRAINT "case_item_usage_stockUnitId_fkey" FOREIGN KEY ("stockUnitId") REFERENCES "stock_unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item_usage" ADD CONSTRAINT "case_item_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Parts already consumed on cases (units consumed with a case) become usage records.
INSERT INTO "case_item_usage" ("id", "caseId", "itemId", "kind", "stockUnitId", "userId", "at")
SELECT gen_random_uuid()::text, "allocatedCaseId", "itemId", 'CONSUMED', "id", "consumedById", COALESCE("consumedAt", now())
FROM "stock_unit" WHERE "status" = 'CONSUMED' AND "allocatedCaseId" IS NOT NULL;
