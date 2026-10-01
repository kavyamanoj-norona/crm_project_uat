-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('REPEAT_CUSTOMER', 'WALK_IN', 'REFERRAL', 'ADVERTISEMENT', 'SOCIAL_MEDIA', 'GOOGLE_SEARCH', 'OTHER');

-- CreateEnum
CREATE TYPE "IntakeType" AS ENUM ('WALK_IN', 'PICKUP', 'ON_SITE');

-- CreateEnum
CREATE TYPE "ProductType" AS ENUM ('LAPTOP', 'PRINTER', 'DESKTOP', 'OTHER');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('NON_WARRANTY', 'WARRANTY', 'RETURN');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('INTAKE', 'DIAGNOSIS', 'PENDING_APPROVAL', 'AWAITING_STOCK', 'QUALITY_CHECK', 'READY_FOR_DELIVERY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('GOOD', 'FAIR', 'WORN', 'DAMAGED');

-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('UPI', 'CASH', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('ADVANCE', 'FINAL', 'OTHER');

-- CreateTable
CREATE TABLE "number_sequence" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "number_sequence_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "email" TEXT,
    "gstin" TEXT,
    "address" TEXT,
    "state" TEXT,
    "district" TEXT,
    "pincode" TEXT,
    "source" "LeadSource",
    "notes" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_case" (
    "id" TEXT NOT NULL,
    "jobsheetNo" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "accountId" TEXT,
    "intakeType" "IntakeType" NOT NULL DEFAULT 'WALK_IN',
    "source" "LeadSource" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'INTAKE',
    "siteAddress" TEXT,
    "siteLatitude" DOUBLE PRECISION,
    "siteLongitude" DOUBLE PRECISION,
    "productType" "ProductType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "serialNo" TEXT,
    "warrantyStatus" "WarrantyStatus" NOT NULL,
    "devicePasswordEnc" TEXT,
    "problemReported" TEXT NOT NULL,
    "estimatedCostPaise" INTEGER,
    "gstInvoiceRequired" BOOLEAN NOT NULL DEFAULT false,
    "expectedDeliveryDate" DATE,
    "engineerId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_received_item" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "referenceNo" TEXT,
    "condition" "ItemCondition" NOT NULL DEFAULT 'GOOD',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_received_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_attachment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'INTAKE_PHOTO',
    "url" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromStatus" "CaseStatus",
    "toStatus" "CaseStatus" NOT NULL,
    "note" TEXT,
    "changedById" TEXT,
    "at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "caseId" TEXT,
    "customerId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reference" TEXT,
    "receivedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_code_key" ON "customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "customer_phone_key" ON "customer"("phone");

-- CreateIndex
CREATE INDEX "customer_name_idx" ON "customer"("name");

-- CreateIndex
CREATE INDEX "customer_createdAt_idx" ON "customer"("createdAt");

-- CreateIndex
CREATE INDEX "customer_lastVisitAt_idx" ON "customer"("lastVisitAt");

-- CreateIndex
CREATE UNIQUE INDEX "service_case_jobsheetNo_key" ON "service_case"("jobsheetNo");

-- CreateIndex
CREATE INDEX "service_case_branchId_status_createdAt_idx" ON "service_case"("branchId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "service_case_customerId_idx" ON "service_case"("customerId");

-- CreateIndex
CREATE INDEX "service_case_accountId_idx" ON "service_case"("accountId");

-- CreateIndex
CREATE INDEX "service_case_engineerId_idx" ON "service_case"("engineerId");

-- CreateIndex
CREATE INDEX "case_received_item_caseId_idx" ON "case_received_item"("caseId");

-- CreateIndex
CREATE INDEX "case_attachment_caseId_idx" ON "case_attachment"("caseId");

-- CreateIndex
CREATE INDEX "case_status_history_caseId_at_idx" ON "case_status_history"("caseId", "at");

-- CreateIndex
CREATE INDEX "payment_branchId_createdAt_idx" ON "payment"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_caseId_idx" ON "payment"("caseId");

-- CreateIndex
CREATE INDEX "payment_customerId_idx" ON "payment"("customerId");

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_case" ADD CONSTRAINT "service_case_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_received_item" ADD CONSTRAINT "case_received_item_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_attachment" ADD CONSTRAINT "case_attachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
