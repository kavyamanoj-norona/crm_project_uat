-- CreateEnum
CREATE TYPE "BillPaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gstin" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_bill" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "billNoNorm" TEXT NOT NULL,
    "billDate" DATE NOT NULL,
    "subtotalPaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "roundOffPaise" INTEGER NOT NULL DEFAULT 0,
    "totalPaise" INTEGER NOT NULL,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "BillPaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "imageUrl" TEXT,
    "imageHash" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_bill_item" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "hsnSac" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitCostPaise" INTEGER NOT NULL,
    "gstPercent" INTEGER NOT NULL,
    "taxablePaise" INTEGER NOT NULL,
    "taxPaise" INTEGER NOT NULL,
    "lineTotalPaise" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_bill_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_bill_payment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "referenceNo" TEXT,
    "note" TEXT,
    "paidAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_bill_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_gstin_key" ON "supplier"("gstin");

-- CreateIndex
CREATE INDEX "supplier_name_idx" ON "supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_bill_code_key" ON "purchase_bill"("code");

-- CreateIndex
CREATE INDEX "purchase_bill_branchId_billDate_idx" ON "purchase_bill"("branchId", "billDate");

-- CreateIndex
CREATE INDEX "purchase_bill_imageHash_idx" ON "purchase_bill"("imageHash");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_bill_supplierId_billNoNorm_key" ON "purchase_bill"("supplierId", "billNoNorm");

-- CreateIndex
CREATE INDEX "purchase_bill_item_billId_idx" ON "purchase_bill_item"("billId");

-- CreateIndex
CREATE INDEX "purchase_bill_item_itemId_idx" ON "purchase_bill_item"("itemId");

-- CreateIndex
CREATE INDEX "purchase_bill_payment_billId_idx" ON "purchase_bill_payment"("billId");

-- AddForeignKey
ALTER TABLE "purchase_bill" ADD CONSTRAINT "purchase_bill_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill" ADD CONSTRAINT "purchase_bill_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill" ADD CONSTRAINT "purchase_bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_item" ADD CONSTRAINT "purchase_bill_item_billId_fkey" FOREIGN KEY ("billId") REFERENCES "purchase_bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_item" ADD CONSTRAINT "purchase_bill_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_payment" ADD CONSTRAINT "purchase_bill_payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "purchase_bill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_bill_payment" ADD CONSTRAINT "purchase_bill_payment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
