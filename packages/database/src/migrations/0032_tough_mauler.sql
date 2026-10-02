-- Orphan backfill: any appointment missing assignment rows gets a lead from appointments.staff_id
INSERT INTO "appointment_staff_assignments" (
	"salon_id", "appointment_id", "staff_id", "is_lead", "allocation_basis_points", "commission_excluded_at", "created_at", "updated_at"
)
SELECT a."salon_id", a."id", a."staff_id", true, 10000, a."commission_excluded_at", a."created_at", a."updated_at"
FROM "appointments" AS a
WHERE NOT EXISTS (
	SELECT 1
	FROM "appointment_staff_assignments" AS asa
	WHERE asa."appointment_id" = a."id"
);
--> statement-breakpoint
-- Fail loud if any appointment still lacks a lead assignment after backfill
DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM "appointments" AS a
		WHERE NOT EXISTS (
			SELECT 1
			FROM "appointment_staff_assignments" AS asa
			WHERE asa."appointment_id" = a."id" AND asa."is_lead" = true
		)
	) THEN
		RAISE EXCEPTION 'BL-0081: appointments without a lead assignment remain after orphan backfill';
	END IF;
END $$;
--> statement-breakpoint
DROP INDEX "appointments_salon_id_staff_id_date_idx";--> statement-breakpoint
DROP INDEX "appointments_staff_id_date_idx";--> statement-breakpoint
ALTER TABLE "appointments" DROP COLUMN "staff_id";
