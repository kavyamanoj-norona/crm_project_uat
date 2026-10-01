-- CreateEnum
CREATE TYPE "WaMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "whatsapp_message" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WaMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "metaMessageId" TEXT,
    "error" TEXT,
    "sentAt" TIMESTAMPTZ,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_message_caseId_createdAt_idx" ON "whatsapp_message"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
