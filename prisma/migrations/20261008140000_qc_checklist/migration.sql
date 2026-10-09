-- CreateTable
CREATE TABLE "qc_checklist_item" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "qc_checklist_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_checklist_item_isActive_idx" ON "qc_checklist_item"("isActive");

-- AddForeignKey
ALTER TABLE "qc_checklist_item" ADD CONSTRAINT "qc_checklist_item_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "qc_checklist_item" ADD CONSTRAINT "qc_checklist_item_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
