-- CreateEnum
CREATE TYPE "TatUnit" AS ENUM ('MINUTES', 'HOURS', 'DAYS');

-- CreateTable
CREATE TABLE "tat_config" (
    "id" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL,
    "targetValue" INTEGER NOT NULL,
    "targetUnit" "TatUnit" NOT NULL DEFAULT 'HOURS',
    "warningThreshold" INTEGER NOT NULL DEFAULT 80,
    "escalationThreshold" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tat_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tat_config_status_key" ON "tat_config"("status");

-- AddForeignKey
ALTER TABLE "tat_config" ADD CONSTRAINT "tat_config_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tat_config" ADD CONSTRAINT "tat_config_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
