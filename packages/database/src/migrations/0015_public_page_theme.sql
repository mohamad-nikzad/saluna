ALTER TABLE "salon_public_settings" DROP COLUMN IF EXISTS "logo_url";
ALTER TABLE "salon_public_settings" DROP COLUMN IF EXISTS "banner_url";
ALTER TABLE "salon_public_settings" DROP COLUMN IF EXISTS "accent_color";
ALTER TABLE "salon_public_settings" ADD COLUMN IF NOT EXISTS "theme_id" text DEFAULT 'rose' NOT NULL;

DROP INDEX IF EXISTS "service_public_visibility_salon_id_sort_idx";
ALTER TABLE "service_public_visibility" DROP COLUMN IF EXISTS "sort_order";
