-- CreateTable
CREATE TABLE "stock_request" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "notes" TEXT,
    "requestedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_request_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "purchase_request" ADD COLUMN "stockRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "stock_request_code_key" ON "stock_request"("code");
CREATE INDEX "stock_request_branchId_createdAt_idx" ON "stock_request"("branchId", "createdAt");
CREATE INDEX "purchase_request_stockRequestId_idx" ON "purchase_request"("stockRequestId");

-- AddForeignKey
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_request" ADD CONSTRAINT "stock_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_stockRequestId_fkey" FOREIGN KEY ("stockRequestId") REFERENCES "stock_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Earlier item-level requests (no case, not a replacement) become one-line Stock Requests, so they show in the branch list.
INSERT INTO "stock_request" ("id", "code", "branchId", "notes", "requestedById", "createdAt", "updatedAt")
SELECT 'sr_' || pr."id", 'SR' || substring(pr."code" from 3), pr."branchId", pr."notes", pr."requestedById", pr."createdAt", pr."createdAt"
FROM "purchase_request" pr
WHERE pr."caseId" IS NULL AND pr."isReplacement" = false AND pr."isDelete" = 0;

UPDATE "purchase_request" pr SET "stockRequestId" = 'sr_' || pr."id"
WHERE pr."caseId" IS NULL AND pr."isReplacement" = false AND pr."isDelete" = 0;

-- Menu: Inventory → Stock Requests, for the branch roles (same as the navigation seed).
INSERT INTO "menu" ("id", "moduleId", "type", "code", "title", "icon", "path", "sortOrder", "isActive", "updatedAt")
SELECT 'menu_stock_requests', m."id", 'ITEM', 'inventory.stock-requests', 'Stock Requests', 'package-plus', '/inventory/stock-requests',
       COALESCE((SELECT "sortOrder" FROM "menu" WHERE "path" = '/inventory/purchasing'), 30) + 5, true, CURRENT_TIMESTAMP
FROM "module" m WHERE m."code" = 'inventory'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "privilege_permission" ("id", "privilegeId", "menuId", "canView", "canCreate", "canEdit", "canDelete", "canApprove", "updatedAt")
SELECT 'perm_sr_' || p."code", p."id", mn."id", true, true, true, false, false, CURRENT_TIMESTAMP
FROM "privilege" p, "menu" mn
WHERE p."code" IN ('BRANCH_MANAGER', 'SALES', 'CHIP_COORDINATOR') AND mn."path" = '/inventory/stock-requests'
ON CONFLICT ("privilegeId", "menuId") DO NOTHING;
