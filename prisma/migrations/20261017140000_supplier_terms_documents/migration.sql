-- AlterTable
ALTER TABLE "supplier" ADD COLUMN "paymentTermDays" INTEGER;

-- CreateTable
CREATE TABLE "supplier_document" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "supplier_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_document_supplierId_idx" ON "supplier_document"("supplierId");

-- AddForeignKey
ALTER TABLE "supplier_document" ADD CONSTRAINT "supplier_document_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
