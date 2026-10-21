-- CreateTable
CREATE TABLE "case_diagnosis" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "recommendedRepairs" TEXT NOT NULL,
    "savedById" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    "isDelete" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "case_diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_diagnosis_caseId_key" ON "case_diagnosis"("caseId");

-- AddForeignKey
ALTER TABLE "case_diagnosis" ADD CONSTRAINT "case_diagnosis_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "service_case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "case_diagnosis" ADD CONSTRAINT "case_diagnosis_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Engineer privilege and the Engineer Workspace menu (same as the navigation seed). Idempotent.
INSERT INTO "privilege" ("id", "code", "name", "isSuperAdmin", "isBranchBound", "homePath", "isActive", "updatedAt")
VALUES ('priv_engineer', 'ENGINEER', 'Engineer', false, true, '/service/engineer', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "menu" ("id", "moduleId", "type", "code", "title", "icon", "path", "sortOrder", "isActive", "updatedAt")
SELECT 'menu_engineer_workspace', m."id", 'ITEM', 'service.engineer-workspace', 'Engineer Workspace', 'stethoscope', '/service/engineer',
       COALESCE((SELECT "sortOrder" FROM "menu" WHERE "path" = '/service/lab'), 40) + 5, true, CURRENT_TIMESTAMP
FROM "module" m WHERE m."code" = 'service'
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "privilege_permission" ("id", "privilegeId", "menuId", "canView", "canCreate", "canEdit", "canDelete", "canApprove", "updatedAt")
SELECT 'perm_eng_' || p."code", p."id", mn."id", true, true, true, false, false, CURRENT_TIMESTAMP
FROM "privilege" p, "menu" mn
WHERE p."code" IN ('ENGINEER', 'BRANCH_MANAGER') AND mn."path" = '/service/engineer'
ON CONFLICT ("privilegeId", "menuId") DO NOTHING;
