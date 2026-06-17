CREATE TABLE "platform_admins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "role" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "revoked_at" timestamp with time zone,
  "created_by_user_id" uuid,
  "revoked_by_user_id" uuid
);
--> statement-breakpoint
CREATE TABLE "admin_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_user_id" uuid NOT NULL,
  "actor_platform_role" text NOT NULL,
  "action" text NOT NULL,
  "target_type" text NOT NULL,
  "target_id" text NOT NULL,
  "salon_id" uuid,
  "reason" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "request_id" text,
  "ip" text,
  "user_agent" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_internal_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "body" text NOT NULL,
  "author_user_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "platform_admins" ADD CONSTRAINT "platform_admins_revoked_by_user_id_user_id_fk" FOREIGN KEY ("revoked_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_audit_events" ADD CONSTRAINT "admin_audit_events_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "admin_internal_notes" ADD CONSTRAINT "admin_internal_notes_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_admins_user_id_unique" ON "platform_admins" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "platform_admins_active_role_idx" ON "platform_admins" USING btree ("active","role");
--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_created_idx" ON "admin_audit_events" USING btree ("actor_user_id","created_at");
--> statement-breakpoint
CREATE INDEX "admin_audit_events_target_idx" ON "admin_audit_events" USING btree ("target_type","target_id");
--> statement-breakpoint
CREATE INDEX "admin_audit_events_salon_created_idx" ON "admin_audit_events" USING btree ("salon_id","created_at");
--> statement-breakpoint
CREATE INDEX "admin_audit_events_action_created_idx" ON "admin_audit_events" USING btree ("action","created_at");
--> statement-breakpoint
CREATE INDEX "admin_internal_notes_subject_created_idx" ON "admin_internal_notes" USING btree ("subject_type","subject_id","created_at");
--> statement-breakpoint
CREATE INDEX "admin_internal_notes_author_created_idx" ON "admin_internal_notes" USING btree ("author_user_id","created_at");
