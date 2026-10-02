CREATE TABLE "appointment_staff_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	"allocation_basis_points" integer NOT NULL,
	"commission_excluded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointment_staff_assignments_allocation_check" CHECK ("appointment_staff_assignments"."allocation_basis_points" >= 0 and "appointment_staff_assignments"."allocation_basis_points" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "allow_multiple_staff" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment_staff_assignments" ADD CONSTRAINT "appointment_staff_assignments_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointment_staff_assignments" ADD CONSTRAINT "appointment_staff_assignments_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "appointment_staff_assignments" (
	"salon_id", "appointment_id", "staff_id", "is_lead", "allocation_basis_points", "commission_excluded_at", "created_at", "updated_at"
)
SELECT "salon_id", "id", "staff_id", true, 10000, "commission_excluded_at", "created_at", "updated_at"
FROM "appointments";--> statement-breakpoint
ALTER TABLE "staff_commissions" ADD COLUMN "appointment_staff_assignment_id" uuid;--> statement-breakpoint
UPDATE "staff_commissions" AS commission
SET "appointment_staff_assignment_id" = assignment."id"
FROM "appointment_staff_assignments" AS assignment
JOIN "staff_profiles" AS profile ON true
WHERE profile."id" = commission."staff_profile_id"
	AND assignment."appointment_id" = commission."appointment_id"
	AND (assignment."staff_id" = profile."id" OR assignment."staff_id" = profile."user_id");--> statement-breakpoint
ALTER TABLE "staff_commissions" ALTER COLUMN "appointment_staff_assignment_id" SET NOT NULL;--> statement-breakpoint
DROP INDEX "staff_commissions_appointment_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_staff_assignments_appointment_staff_unique" ON "appointment_staff_assignments" USING btree ("appointment_id","staff_id");--> statement-breakpoint
CREATE UNIQUE INDEX "appointment_staff_assignments_lead_unique" ON "appointment_staff_assignments" USING btree ("appointment_id") WHERE "appointment_staff_assignments"."is_lead" = true;--> statement-breakpoint
CREATE INDEX "appointment_staff_assignments_salon_staff_idx" ON "appointment_staff_assignments" USING btree ("salon_id","staff_id");--> statement-breakpoint
ALTER TABLE "staff_commissions" ADD CONSTRAINT "staff_commissions_appointment_staff_assignment_id_appointment_staff_assignments_id_fk" FOREIGN KEY ("appointment_staff_assignment_id") REFERENCES "public"."appointment_staff_assignments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_commissions_assignment_unique" ON "staff_commissions" USING btree ("appointment_staff_assignment_id");
