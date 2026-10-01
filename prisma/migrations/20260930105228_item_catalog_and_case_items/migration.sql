-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('SERVICE', 'PART', 'ACCESSORY');

-- CreateTable
CREATE TABLE "item" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ItemType" NOT NULL DEFAULT 'SERVICE',
    "category" TEXT,
    "brand" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'Nos',
    "hsnSac" TEXT,
    "gstPercent" INTEGER NOT NULL DEFAULT 18,
    "pricePaise" INTEGER NOT NULL,
    "maxDiscountPercent" INTEGER NOT NULL DEFAULT 0,
    "warrantyDays" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_item" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ItemType" NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "listPricePaise" INTEGER NOT NULL,
    "minPricePaise" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "gstPercent" INTEGER NOT NULL,
    "lineTotalPaise" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "addedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ,
    "removedById" TEXT,

    CONSTRAINT "case_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_code_key" ON "item"("code");

-- CreateIndex
CREATE INDEX "item_name_idx" ON "item"("name");

-- CreateIndex
CREATE INDEX "item_type_isActive_idx" ON "item"("type", "isActive");

-- CreateIndex
CREATE INDEX "case_item_caseId_removedAt_idx" ON "case_item"("caseId", "removedAt");

-- CreateIndex
CREATE INDEX "case_item_itemId_idx" ON "case_item"("itemId");

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item" ADD CONSTRAINT "case_item_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item" ADD CONSTRAINT "case_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item" ADD CONSTRAINT "case_item_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_item" ADD CONSTRAINT "case_item_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
