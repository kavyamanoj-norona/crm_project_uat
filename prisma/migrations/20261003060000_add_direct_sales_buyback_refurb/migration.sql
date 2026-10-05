-- Migration: add_direct_sales_buyback_refurb
-- Adds DirectSale, DirectSaleItem, BuybackRecord, RefurbItem models
-- and back-relation columns on Branch, User, Customer, Item.

-- CreateEnum
CREATE TYPE "BuybackStatus" AS ENUM ('PENDING_ASSESSMENT', 'SENT_FOR_REFURBISHMENT', 'ADDED_TO_REFURB_STOCK', 'SOLD', 'SCRAPPED');

-- CreateEnum
CREATE TYPE "RefurbStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateTable
CREATE TABLE "direct_sale" (
    "id" TEXT NOT NULL,
    "saleNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "paymentMode" "PaymentMode" NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "soldById" TEXT NOT NULL,
    "soldAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "direct_sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "direct_sale_item" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPricePaise" INTEGER NOT NULL,
    "totalPaise" INTEGER NOT NULL,

    CONSTRAINT "direct_sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyback_record" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "brand" TEXT,
    "deviceModel" TEXT,
    "condition" TEXT NOT NULL,
    "agreedPricePaise" INTEGER NOT NULL,
    "status" "BuybackStatus" NOT NULL DEFAULT 'PENDING_ASSESSMENT',
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "buyback_record_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refurb_item" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "buybackId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "specs" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "costPaise" INTEGER NOT NULL,
    "sellingPricePaise" INTEGER NOT NULL,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 36,
    "serialNo" TEXT,
    "status" "RefurbStatus" NOT NULL DEFAULT 'AVAILABLE',
    "addedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "refurb_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "direct_sale_saleNo_key" ON "direct_sale"("saleNo");

-- CreateIndex
CREATE INDEX "direct_sale_branchId_soldAt_idx" ON "direct_sale"("branchId", "soldAt");

-- CreateIndex
CREATE INDEX "direct_sale_item_saleId_idx" ON "direct_sale_item"("saleId");

-- CreateIndex
CREATE INDEX "buyback_record_branchId_recordedAt_idx" ON "buyback_record"("branchId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "refurb_item_buybackId_key" ON "refurb_item"("buybackId");

-- CreateIndex
CREATE INDEX "refurb_item_branchId_status_idx" ON "refurb_item"("branchId", "status");

-- AddForeignKey
ALTER TABLE "direct_sale" ADD CONSTRAINT "direct_sale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_sale" ADD CONSTRAINT "direct_sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_sale" ADD CONSTRAINT "direct_sale_soldById_fkey" FOREIGN KEY ("soldById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_sale_item" ADD CONSTRAINT "direct_sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "direct_sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "direct_sale_item" ADD CONSTRAINT "direct_sale_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_record" ADD CONSTRAINT "buyback_record_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_record" ADD CONSTRAINT "buyback_record_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_record" ADD CONSTRAINT "buyback_record_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refurb_item" ADD CONSTRAINT "refurb_item_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refurb_item" ADD CONSTRAINT "refurb_item_buybackId_fkey" FOREIGN KEY ("buybackId") REFERENCES "buyback_record"("id") ON DELETE SET NULL ON UPDATE CASCADE;
