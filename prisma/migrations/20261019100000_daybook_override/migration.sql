-- CreateTable
CREATE TABLE "daybook_override" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "daybook_override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daybook_override_branchId_expiresAt_idx" ON "daybook_override"("branchId", "expiresAt");

-- AddForeignKey
ALTER TABLE "daybook_override" ADD CONSTRAINT "daybook_override_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daybook_override" ADD CONSTRAINT "daybook_override_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
