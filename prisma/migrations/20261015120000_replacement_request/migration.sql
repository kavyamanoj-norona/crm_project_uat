-- AlterTable
ALTER TABLE "purchase_request" ADD COLUMN     "isReplacement" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "replacementOfId" TEXT,
ADD COLUMN     "replacementReason" TEXT,
ADD COLUMN     "replacementConfirmedById" TEXT,
ADD COLUMN     "replacementConfirmedAt" TIMESTAMPTZ;

-- AddForeignKey
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_replacementOfId_fkey" FOREIGN KEY ("replacementOfId") REFERENCES "purchase_request"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_request" ADD CONSTRAINT "purchase_request_replacementConfirmedById_fkey" FOREIGN KEY ("replacementConfirmedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
