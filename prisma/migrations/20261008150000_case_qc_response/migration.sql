-- CreateTable
CREATE TABLE "case_qc_response" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "checklistItemId" TEXT NOT NULL,
    "stage" "CaseStatus" NOT NULL,
    "title" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "remarks" TEXT,
    "answeredById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMPTZ,

    CONSTRAINT "case_qc_response_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "case_qc_response_caseId_stage_removedAt_idx" ON "case_qc_response"("caseId", "stage", "removedAt");

-- AddForeignKey
ALTER TABLE "case_qc_response" ADD CONSTRAINT "case_qc_response_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_qc_response" ADD CONSTRAINT "case_qc_response_checklistItemId_fkey" FOREIGN KEY ("checklistItemId") REFERENCES "qc_checklist_item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_qc_response" ADD CONSTRAINT "case_qc_response_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
