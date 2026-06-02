ALTER TABLE "business_settings" ADD COLUMN "working_days" smallint DEFAULT 126 NOT NULL;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "map_google" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "map_neshan" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "map_balad" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "social_instagram" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "social_telegram" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "social_whatsapp" text;--> statement-breakpoint
ALTER TABLE "salon_profile" ADD COLUMN "website" text;