-- Data fix: units already received before receipt moved stock to the branch.
-- Add them to the receiving branch's stock count, then move the unit there.
INSERT INTO "stock_item" ("id", "branchId", "itemId", "quantity", "unitCodes", "updatedAt")
SELECT gen_random_uuid()::text, "allocatedBranchId", "itemId", COUNT(*)::int, ARRAY[]::text[], now()
FROM "stock_unit"
WHERE "status" = 'RECEIVED' AND "allocatedBranchId" IS NOT NULL AND "branchId" <> "allocatedBranchId"
GROUP BY "allocatedBranchId", "itemId"
ON CONFLICT ("branchId", "itemId") DO UPDATE SET "quantity" = "stock_item"."quantity" + EXCLUDED."quantity", "updatedAt" = now();

UPDATE "stock_unit" SET "branchId" = "allocatedBranchId"
WHERE "status" = 'RECEIVED' AND "allocatedBranchId" IS NOT NULL AND "branchId" <> "allocatedBranchId";
