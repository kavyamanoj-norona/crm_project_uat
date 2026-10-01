-- Cases that existed before "stageChangedAt" was added got the migration time.
-- Set it to when the case actually entered its current stage.
UPDATE "service_case" AS c
SET "stageChangedAt" = COALESCE(
  (SELECT max(h."at") FROM "case_status_history" AS h WHERE h."caseId" = c."id" AND h."toStatus" = c."status"),
  c."createdAt"
);
