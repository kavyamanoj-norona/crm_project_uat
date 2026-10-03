-- CreateEnum
CREATE TYPE "CustomerBehaviour" AS ENUM ('COOPERATIVE', 'NORMAL', 'DIFFICULT', 'RUDE', 'EXCELLENT');

-- CreateTable
CREATE TABLE "case_feedback" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "customerBehaviour" "CustomerBehaviour" NOT NULL DEFAULT 'NORMAL',
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "case_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_feedback_caseId_key" ON "case_feedback"("caseId");

-- AddForeignKey
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_feedback" ADD CONSTRAINT "case_feedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
