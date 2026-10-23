-- CreateTable
CREATE TABLE "item_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "item_category_pkey" PRIMARY KEY ("id")
);

-- No two live categories share a name, ignoring case.
CREATE UNIQUE INDEX "item_category_name_live_key" ON "item_category" (lower("name")) WHERE "isDelete" = 0;

-- Link existing items: one category per distinct name already in use (case variants merge into one), plus
-- "General" for items that had none.
INSERT INTO "item_category" ("id", "name")
SELECT 'cat' || md5(lower(n) || random()::text), n
FROM (SELECT DISTINCT ON (lower(btrim("category"))) btrim("category") AS n
      FROM "item" WHERE "category" IS NOT NULL AND btrim("category") <> ''
      ORDER BY lower(btrim("category")), btrim("category")) c;

INSERT INTO "item_category" ("id", "name")
SELECT 'cat' || md5('general' || random()::text), 'General'
WHERE EXISTS (SELECT 1 FROM "item" WHERE "category" IS NULL OR btrim("category") = '')
  AND NOT EXISTS (SELECT 1 FROM "item_category" WHERE lower("name") = 'general');

-- AlterTable
ALTER TABLE "item" ADD COLUMN "categoryId" TEXT;

UPDATE "item" i SET "categoryId" = c."id"
FROM "item_category" c
WHERE lower(c."name") = lower(btrim(i."category"));

UPDATE "item" SET "categoryId" = (SELECT "id" FROM "item_category" WHERE lower("name") = 'general')
WHERE "categoryId" IS NULL;

ALTER TABLE "item" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "item" DROP COLUMN "category";

-- CreateIndex
CREATE INDEX "item_categoryId_idx" ON "item"("categoryId");

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "item_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
