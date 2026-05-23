ALTER TABLE "salon_public_settings" ADD COLUMN IF NOT EXISTS "layout_id" text DEFAULT 'agenda' NOT NULL;
