-- CreateTable
CREATE TABLE "stock_attachment" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "stockRequestId" TEXT,
    "purchaseRequestId" TEXT,
    "stockUnitId" TEXT,
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stock_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stock_attachment_stockRequestId_idx" ON "stock_attachment"("stockRequestId");

-- CreateIndex
CREATE INDEX "stock_attachment_purchaseRequestId_idx" ON "stock_attachment"("purchaseRequestId");
