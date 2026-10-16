-- CreateTable
CREATE TABLE "usid_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "prefix" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "nextNumber" INTEGER NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "usid_config_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "usid_config" ADD CONSTRAINT "usid_config_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
