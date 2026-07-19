ALTER TABLE "appointments" ADD COLUMN "commission_excluded_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "appointments"
SET "commission_excluded_at" = "updated_at"
WHERE "status" = 'completed'
  AND NOT EXISTS (
    SELECT 1
    FROM "staff_commissions"
    WHERE "staff_commissions"."appointment_id" = "appointments"."id"
  );
