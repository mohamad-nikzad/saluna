INSERT INTO "staff_profiles" (
  "id", "salon_id", "user_id", "name", "phone", "color", "active", "claimed_at"
)
SELECT
  m."user_id",
  m."organization_id",
  m."user_id",
  COALESCE(NULLIF(sm."display_name", ''), u."name"),
  COALESCE(u."phone_number", u."username"),
  COALESCE(sm."color", 'coral'),
  COALESCE(sm."active", true),
  now()
FROM "member" m
JOIN "user" u ON u."id" = m."user_id"
LEFT JOIN "salon_member" sm
  ON sm."user_id" = m."user_id"
 AND sm."organization_id" = m."organization_id"
WHERE m."role" = 'member'
  AND COALESCE(u."phone_number", u."username") IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "staff_profile_accesses" (
  "salon_id", "staff_profile_id", "user_id", "accepted_at"
)
SELECT sp."salon_id", sp."id", sp."user_id", COALESCE(sp."claimed_at", now())
FROM "staff_profiles" sp
WHERE sp."user_id" IS NOT NULL
  AND sp."access_detached_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "staff_profile_accesses" spa
    WHERE spa."user_id" = sp."user_id"
      AND spa."salon_id" = sp."salon_id"
      AND spa."revoked_at" IS NULL
  )
ON CONFLICT DO NOTHING;
