-- The Onsite Pickup privilege: sees New Case (Intake) only. Idempotent; same as the navigation seed.
INSERT INTO "privilege" ("id", "code", "name", "isSuperAdmin", "isBranchBound", "homePath", "isActive", "updatedAt")
VALUES ('priv_onsite_pickup', 'ONSITE_PICKUP', 'Onsite Pickup', false, false, '/service/new', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "privilege_permission" ("id", "privilegeId", "menuId", "canView", "canCreate", "canEdit", "canDelete", "canApprove", "updatedAt")
SELECT 'perm_onsite_intake', p."id", m."id", true, true, true, false, false, CURRENT_TIMESTAMP
FROM "privilege" p, "menu" m
WHERE p."code" = 'ONSITE_PICKUP' AND m."path" = '/service/new'
ON CONFLICT ("privilegeId", "menuId") DO NOTHING;
