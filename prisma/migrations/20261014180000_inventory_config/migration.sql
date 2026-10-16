-- The USID configuration becomes the general inventory configuration (USID numbering + GST rates).
ALTER TABLE "usid_config" RENAME TO "inventory_config";
ALTER TABLE "inventory_config" RENAME CONSTRAINT "usid_config_pkey" TO "inventory_config_pkey";
ALTER TABLE "inventory_config" RENAME CONSTRAINT "usid_config_updatedById_fkey" TO "inventory_config_updatedById_fkey";
ALTER TABLE "inventory_config" ADD COLUMN "gstRates" INTEGER[] DEFAULT ARRAY[0, 5, 12, 18, 28];
