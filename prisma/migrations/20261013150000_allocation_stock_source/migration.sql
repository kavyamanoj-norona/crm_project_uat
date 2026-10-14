-- Allocations can also come from stock that has no supplier bill (opening / adjusted stock).
ALTER TABLE "stock_allocation" ALTER COLUMN "billItemId" DROP NOT NULL;
