-- Engineer Workspace belongs to the existing Service Engineer privilege, not a new one.
INSERT INTO "privilege_permission" ("id", "privilegeId", "menuId", "canView", "canCreate", "canEdit", "canDelete", "canApprove", "updatedAt")
SELECT 'perm_eng_' || p."code", p."id", mn."id", true, true, true, false, false, CURRENT_TIMESTAMP
FROM "privilege" p, "menu" mn
WHERE p."code" = 'SERVICE_ENGINEER' AND mn."path" = '/service/engineer'
ON CONFLICT ("privilegeId", "menuId") DO NOTHING;

-- Remove the ENGINEER privilege added by the previous migration, if nobody has been given it.
DELETE FROM "privilege_permission" WHERE "privilegeId" IN (
  SELECT p."id" FROM "privilege" p WHERE p."code" = 'ENGINEER' AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."privilegeId" = p."id"));
DELETE FROM "privilege" p WHERE p."code" = 'ENGINEER' AND NOT EXISTS (SELECT 1 FROM "user" u WHERE u."privilegeId" = p."id");
