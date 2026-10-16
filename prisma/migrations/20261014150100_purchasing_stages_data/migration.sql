-- Requests that were fully met by allocating units are now "Transferred".
UPDATE "purchase_request" SET "status" = 'TRANSFERRED', "transferredAt" = "updatedAt" WHERE "status" = 'CONSUMED';
-- Open requests that were already approved are treated as ordered.
UPDATE "purchase_request" SET "status" = 'ORDERED', "orderedAt" = COALESCE("reviewedAt", "createdAt") WHERE "status" = 'APPROVED';
