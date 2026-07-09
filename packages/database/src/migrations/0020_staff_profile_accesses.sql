CREATE TABLE "staff_profile_accesses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"staff_profile_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"staff_invite_id" uuid,
	"accepted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff_profile_accesses" ADD CONSTRAINT "staff_profile_accesses_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile_accesses" ADD CONSTRAINT "staff_profile_accesses_staff_profile_id_staff_profiles_id_fk" FOREIGN KEY ("staff_profile_id") REFERENCES "public"."staff_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile_accesses" ADD CONSTRAINT "staff_profile_accesses_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_profile_accesses" ADD CONSTRAINT "staff_profile_accesses_staff_invite_id_staff_invites_id_fk" FOREIGN KEY ("staff_invite_id") REFERENCES "public"."staff_invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profile_accesses_user_salon_active_unique" ON "staff_profile_accesses" USING btree ("user_id","salon_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profile_accesses_profile_active_unique" ON "staff_profile_accesses" USING btree ("staff_profile_id") WHERE "revoked_at" is null;--> statement-breakpoint
CREATE INDEX "staff_profile_accesses_user_id_idx" ON "staff_profile_accesses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "staff_profile_accesses_salon_id_idx" ON "staff_profile_accesses" USING btree ("salon_id");--> statement-breakpoint
DROP INDEX IF EXISTS "staff_profiles_user_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "staff_profiles_salon_id_user_id_unique" ON "staff_profiles" USING btree ("salon_id","user_id") WHERE "user_id" is not null;--> statement-breakpoint
CREATE INDEX "staff_profiles_user_id_idx" ON "staff_profiles" USING btree ("user_id");
