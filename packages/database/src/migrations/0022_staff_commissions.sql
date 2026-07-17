CREATE TABLE "commission_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"percentage_basis_points" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"activated_at" timestamp with time zone NOT NULL,
	"disabled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "commission_agreements_percentage_check" CHECK ("commission_agreements"."percentage_basis_points" > 0 and "commission_agreements"."percentage_basis_points" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "staff_commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"basis" integer NOT NULL,
	"percentage_basis_points" integer NOT NULL,
	"amount" integer NOT NULL,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_commissions_basis_check" CHECK ("staff_commissions"."basis" >= 0),
	CONSTRAINT "staff_commissions_amount_check" CHECK ("staff_commissions"."amount" >= 0),
	CONSTRAINT "staff_commissions_percentage_check" CHECK ("staff_commissions"."percentage_basis_points" > 0 and "staff_commissions"."percentage_basis_points" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commission_agreements" ADD CONSTRAINT "commission_agreements_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_commissions" ADD CONSTRAINT "staff_commissions_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_commissions" ADD CONSTRAINT "staff_commissions_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_commissions" ADD CONSTRAINT "staff_commissions_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "commission_agreements_salon_profile_unique" ON "commission_agreements" USING btree ("salon_id","staff_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staff_commissions_appointment_unique" ON "staff_commissions" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "staff_commissions_salon_profile_idx" ON "staff_commissions" USING btree ("salon_id","staff_profile_id");
