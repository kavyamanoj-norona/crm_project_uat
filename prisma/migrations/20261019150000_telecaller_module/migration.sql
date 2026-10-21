-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'HOT', 'APPOINTMENT', 'CONVERTED', 'WALKED_IN', 'BILLED', 'LOST');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('INTERESTED', 'NOT_INTERESTED', 'CALL_BACK', 'NO_ANSWER', 'SWITCHED_OFF', 'WRONG_NUMBER', 'APPOINTMENT_FIXED', 'OTHER');

-- CreateEnum
CREATE TYPE "CallSide" AS ENUM ('TELECALLER', 'BRANCH');

-- CreateEnum
CREATE TYPE "IncentiveBasis" AS ENUM ('PER_CONVERSION', 'PER_BILLING', 'MARGIN_PERCENT');

-- CreateTable
CREATE TABLE "lead_profile" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "serviceMode" "IntakeType",
    "appointmentAt" TIMESTAMPTZ,
    "walkInDate" TIMESTAMPTZ,
    "billingDate" TIMESTAMPTZ,
    "tokenNo" TEXT,
    "purchaseCostPaise" INTEGER,
    "marginPaise" INTEGER,
    "firstInteractionAt" TIMESTAMPTZ,
    "salesPersonId" TEXT,
    "assignedTelecallerId" TEXT,
    "assignedToBranchAt" TIMESTAMPTZ,
    "assignedToBranchById" TEXT,
    "lastCallAt" TIMESTAMPTZ,
    "lastOutcome" "CallOutcome",
    "nextFollowUpAt" TIMESTAMPTZ,
    "billedInvoiceId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lead_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_call" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "side" "CallSide" NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "remarks" TEXT,
    "nextFollowUpAt" TIMESTAMPTZ,
    "calledAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledById" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lead_call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_price_estimate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productType" "ProductType",
    "minPaise" INTEGER NOT NULL,
    "maxPaise" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "service_price_estimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incentive_rule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "basis" "IncentiveBasis" NOT NULL,
    "amountPaise" INTEGER,
    "percentBp" INTEGER,
    "minMarginPaise" INTEGER,
    "effectiveFrom" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "incentive_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecaller_target" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "conversionsTarget" INTEGER NOT NULL DEFAULT 0,
    "billingsTarget" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "telecaller_target_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lead_profile_customerId_key" ON "lead_profile"("customerId");

-- CreateIndex
CREATE INDEX "lead_profile_assignedTelecallerId_nextFollowUpAt_idx" ON "lead_profile"("assignedTelecallerId", "nextFollowUpAt");

-- CreateIndex
CREATE INDEX "lead_profile_status_idx" ON "lead_profile"("status");

-- CreateIndex
CREATE INDEX "lead_profile_nextFollowUpAt_idx" ON "lead_profile"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "lead_call_customerId_calledAt_idx" ON "lead_call"("customerId", "calledAt");

-- CreateIndex
CREATE INDEX "lead_call_calledById_calledAt_idx" ON "lead_call"("calledById", "calledAt");

-- CreateIndex
CREATE INDEX "service_price_estimate_isActive_name_idx" ON "service_price_estimate"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "telecaller_target_userId_month_key" ON "telecaller_target"("userId", "month");

-- AddForeignKey
ALTER TABLE "lead_profile" ADD CONSTRAINT "lead_profile_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_profile" ADD CONSTRAINT "lead_profile_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_profile" ADD CONSTRAINT "lead_profile_assignedTelecallerId_fkey" FOREIGN KEY ("assignedTelecallerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_profile" ADD CONSTRAINT "lead_profile_assignedToBranchById_fkey" FOREIGN KEY ("assignedToBranchById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call" ADD CONSTRAINT "lead_call_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call" ADD CONSTRAINT "lead_call_calledById_fkey" FOREIGN KEY ("calledById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_call" ADD CONSTRAINT "lead_call_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecaller_target" ADD CONSTRAINT "telecaller_target_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ─── Backfill: every existing lead (open or converted) gets its profile ──────────────────────────────────────────
INSERT INTO "lead_profile" ("id", "customerId", "status", "firstInteractionAt", "walkInDate", "billingDate", "billedInvoiceId", "updatedAt")
SELECT 'lp_' || c."id", c."id",
       CASE WHEN inv."id" IS NOT NULL THEN 'BILLED'::"LeadStatus"
            WHEN wi."at" IS NOT NULL THEN 'WALKED_IN'::"LeadStatus"
            WHEN c."kind" = 'CUSTOMER' THEN 'CONVERTED'::"LeadStatus"
            ELSE 'NEW'::"LeadStatus" END,
       c."createdAt", wi."at", inv."issuedAt", inv."id", CURRENT_TIMESTAMP
FROM "customer" c
LEFT JOIN LATERAL (SELECT min(sc."createdAt") AS "at" FROM "service_case" sc WHERE sc."customerId" = c."id" AND sc."createdAt" >= c."convertedAt") wi ON c."convertedAt" IS NOT NULL
LEFT JOIN LATERAL (SELECT ci."id", ci."issuedAt" FROM "case_invoice" ci WHERE ci."customerId" = c."id" AND ci."issuedAt" >= c."convertedAt" ORDER BY ci."issuedAt" LIMIT 1) inv ON c."convertedAt" IS NOT NULL
WHERE c."leadCode" IS NOT NULL AND c."isDelete" = 0
ON CONFLICT ("customerId") DO NOTHING;

-- ─── Telecaller module, above the Owner (Company) module ─────────────────────────────────────────────────────────
UPDATE "module" SET "sortOrder" = "sortOrder" + 1
WHERE "code" IN ('company', 'admin') AND NOT EXISTS (SELECT 1 FROM "module" WHERE "code" = 'telecaller');

INSERT INTO "module" ("id", "code", "title", "icon", "path", "sortOrder", "isActive", "updatedAt")
SELECT 'mod_telecaller', 'telecaller', 'Telecaller', 'phone-call', '/telecaller',
       COALESCE((SELECT "sortOrder" FROM "module" WHERE "code" = 'company'), 7) - 1, true, CURRENT_TIMESTAMP
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "privilege" ("id", "code", "name", "isSuperAdmin", "isBranchBound", "homePath", "isActive", "updatedAt")
VALUES ('priv_telecaller', 'TELECALLER', 'Telecaller', false, false, '/telecaller/dashboard', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- The Leads menu moves over with all of its permissions.
UPDATE "menu" SET "moduleId" = (SELECT "id" FROM "module" WHERE "code" = 'telecaller'), "path" = '/telecaller/leads', "code" = 'telecaller.leads', "sortOrder" = 20
WHERE "code" = 'customers.leads' AND NOT EXISTS (SELECT 1 FROM "menu" WHERE "code" = 'telecaller.leads');

INSERT INTO "menu" ("id", "moduleId", "type", "code", "title", "icon", "path", "sortOrder", "isActive", "updatedAt")
SELECT v."id", m."id", 'ITEM', v."code", v."title", v."icon", v."path", v."sort", true, CURRENT_TIMESTAMP
FROM "module" m,
     (VALUES ('menu_tc_dashboard', 'telecaller.dashboard', 'Dashboard', 'layout-dashboard', '/telecaller/dashboard', 10),
             ('menu_tc_branch_calls', 'telecaller.branch-call-list', 'Branch Call List', 'phone-incoming', '/telecaller/branch-calls', 30),
             ('menu_tc_prices', 'telecaller.service-prices', 'Service Prices', 'indian-rupee', '/telecaller/service-prices', 40),
             ('menu_tc_incentives', 'telecaller.incentives', 'Incentives', 'badge-indian-rupee', '/telecaller/incentives', 50)) AS v("id", "code", "title", "icon", "path", "sort")
WHERE m."code" = 'telecaller'
ON CONFLICT ("code") DO NOTHING;

-- Permissions (view, create, edit): the telecaller works the dashboard and leads and can only look at the rest;
-- branch roles get the Branch Call List with edit rights.
INSERT INTO "privilege_permission" ("id", "privilegeId", "menuId", "canView", "canCreate", "canEdit", "canDelete", "canApprove", "updatedAt")
SELECT 'perm_tc_' || p."code" || '_' || substr(mn."code", 11), p."id", mn."id", true, v."c", v."e", false, false, CURRENT_TIMESTAMP
FROM "privilege" p
JOIN (VALUES ('TELECALLER', 'telecaller.dashboard', true, true),
             ('TELECALLER', 'telecaller.leads', true, true),
             ('TELECALLER', 'telecaller.branch-call-list', false, false),
             ('TELECALLER', 'telecaller.service-prices', false, false),
             ('TELECALLER', 'telecaller.incentives', false, false),
             ('BRANCH_MANAGER', 'telecaller.branch-call-list', true, true),
             ('SALES', 'telecaller.branch-call-list', true, true),
             ('FRONT_DESK', 'telecaller.branch-call-list', true, true)) AS v("pc", "mc", "c", "e") ON v."pc" = p."code"
JOIN "menu" mn ON mn."code" = v."mc"
ON CONFLICT ("privilegeId", "menuId") DO NOTHING;
