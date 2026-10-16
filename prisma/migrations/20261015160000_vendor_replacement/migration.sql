-- CreateEnum
CREATE TYPE "VendorReplacementStatus" AS ENUM ('REQUESTED', 'READY', 'TRANSFERRED', 'RECEIVED');

-- CreateTable
CREATE TABLE "vendor_replacement" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "caseId" TEXT,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "vendorName" TEXT,
    "remarks" TEXT,
    "vendorRemarks" TEXT,
    "status" "VendorReplacementStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendorReadyAt" TIMESTAMPTZ,
    "vendorReadyById" TEXT,
    "transferredAt" TIMESTAMPTZ,
    "transferredById" TEXT,
    "receivedAt" TIMESTAMPTZ,
    "receivedById" TEXT,
    "returnReceivedAt" TIMESTAMPTZ,
    "returnReceivedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "vendor_replacement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vendor_replacement_code_key" ON "vendor_replacement"("code");
CREATE INDEX "vendor_replacement_status_idx" ON "vendor_replacement"("status");
CREATE INDEX "vendor_replacement_unitId_idx" ON "vendor_replacement"("unitId");
CREATE INDEX "vendor_replacement_caseId_idx" ON "vendor_replacement"("caseId");

-- AddForeignKey
ALTER TABLE "vendor_replacement" ADD CONSTRAINT "vendor_replacement_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "stock_unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_replacement" ADD CONSTRAINT "vendor_replacement_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "vendor_replacement" ADD CONSTRAINT "vendor_replacement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "vendor_replacement" ADD CONSTRAINT "vendor_replacement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defective units already waiting for the vendor get a vendor replacement record.
INSERT INTO "vendor_replacement" ("id", "code", "unitId", "caseId", "branchId", "itemId", "remarks", "status", "requestedAt", "returnReceivedAt", "updatedAt")
SELECT gen_random_uuid()::text,
       'VR-' || upper(b."code") || '-' || to_char(now(), 'YYMM') || '-L' || lpad((row_number() OVER (ORDER BY u."returnedAt"))::text, 2, '0'),
       u."id", u."allocatedCaseId", COALESCE(u."allocatedBranchId", u."branchId"), u."itemId", u."returnRemarks", 'REQUESTED',
       COALESCE(u."returnedAt", now()), u."returnReceivedAt", now()
FROM "stock_unit" u JOIN "branch" b ON b."id" = COALESCE(u."allocatedBranchId", u."branchId")
WHERE u."status" = 'AWAITING_VENDOR' AND u."isDelete" = 0;
