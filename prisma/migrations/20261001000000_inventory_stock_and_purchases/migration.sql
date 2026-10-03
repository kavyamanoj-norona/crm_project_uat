-- CreateEnum
CREATE TYPE "PurchaseRequestStatus" AS ENUM ('PENDING', 'WITH_PM', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'DISPATCHED', 'RECEIVED', 'CANCELLED');

-- CreateTable
CREATE TABLE "stock_item" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "unitCodes" TEXT[],
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_request" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "caseId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "status" "PurchaseRequestStatus" NOT NULL DEFAULT 'PENDING',
    "slaBreachAt" TIMESTAMPTZ,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "purchase_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "notes" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMPTZ,
    "dispatchedAt" TIMESTAMPTZ,
    "receivedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_item" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitCodes" TEXT[],

    CONSTRAINT "stock_transfer_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stock_item_branchId_itemId_key" ON "stock_item"("branchId", "itemId");
CREATE INDEX "stock_item_branchId_idx" ON "stock_item"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_request_code_key" ON "purchase_request"("code");
CREATE INDEX "purchase_request_branchId_status_idx" ON "purchase_request"("branchId", "status");
CREATE INDEX "purchase_request_itemId_idx" ON "purchase_request"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_code_key" ON "stock_transfer"("code");
CREATE INDEX "stock_transfer_fromBranchId_status_idx" ON "stock_transfer"("fromBranchId", "status");
CREATE INDEX "stock_transfer_toBranchId_status_idx" ON "stock_transfer"("toBranchId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfer_item_transferId_itemId_key" ON "stock_transfer_item"("transferId", "itemId");
CREATE INDEX "stock_transfer_item_transferId_idx" ON "stock_transfer_item"("transferId");

-- AddForeignKey
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_item" ADD CONSTRAINT "stock_item_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_transfer" ADD CONSTRAINT "stock_transfer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "stock_transfer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transfer_item" ADD CONSTRAINT "stock_transfer_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
