-- CreateEnum
CREATE TYPE "RuleValueType" AS ENUM ('NUMBER', 'PERCENT', 'HOURS', 'MINUTES', 'BOOLEAN', 'TEXT');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ,
ADD COLUMN     "lockedUntil" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "rule" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "valueType" "RuleValueType" NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rule_code_key" ON "rule"("code");

-- CreateIndex
CREATE INDEX "rule_category_idx" ON "rule"("category");

-- AddForeignKey
ALTER TABLE "rule" ADD CONSTRAINT "rule_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
