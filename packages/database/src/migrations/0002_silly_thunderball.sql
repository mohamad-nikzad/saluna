CREATE TABLE "messaging_link_tokens" (
	"token" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"salon_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_messaging_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"display_name" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salon_public_settings" ADD COLUMN "enabled_messaging_providers" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "messaging_link_tokens" ADD CONSTRAINT "messaging_link_tokens_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_link_tokens" ADD CONSTRAINT "messaging_link_tokens_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_messaging_accounts" ADD CONSTRAINT "user_messaging_accounts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "messaging_link_tokens_user_provider_idx" ON "messaging_link_tokens" USING btree ("user_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX "user_messaging_accounts_provider_external_id_unique" ON "user_messaging_accounts" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_messaging_accounts_user_id_provider_unique" ON "user_messaging_accounts" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "user_messaging_accounts_user_id_idx" ON "user_messaging_accounts" USING btree ("user_id");