CREATE TABLE "service_commission_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"commission_agreement_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"percentage_basis_points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_commission_overrides_percentage_check" CHECK ("service_commission_overrides"."percentage_basis_points" > 0 and "service_commission_overrides"."percentage_basis_points" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "service_commission_overrides" ADD CONSTRAINT "service_commission_overrides_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_commission_overrides" ADD CONSTRAINT "service_commission_overrides_commission_agreement_id_commission_agreements_id_fk" FOREIGN KEY ("commission_agreement_id") REFERENCES "public"."commission_agreements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_commission_overrides" ADD CONSTRAINT "service_commission_overrides_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_commission_overrides_agreement_service_unique" ON "service_commission_overrides" USING btree ("commission_agreement_id","service_id");--> statement-breakpoint
CREATE INDEX "service_commission_overrides_salon_agreement_idx" ON "service_commission_overrides" USING btree ("salon_id","commission_agreement_id");