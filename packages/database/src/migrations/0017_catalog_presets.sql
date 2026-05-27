CREATE TABLE IF NOT EXISTS "catalog_presets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "tree" jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_presets_slug_unique"
  ON "catalog_presets" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "catalog_presets_active_sort_idx"
  ON "catalog_presets" USING btree ("is_active","sort_order");

CREATE TABLE IF NOT EXISTS "preset_applications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "preset_id" uuid NOT NULL,
  "applied_at" timestamp with time zone DEFAULT now() NOT NULL,
  "imported_variant_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "preset_applications"
    ADD CONSTRAINT "preset_applications_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "preset_applications"
    ADD CONSTRAINT "preset_applications_preset_id_catalog_presets_id_fk"
    FOREIGN KEY ("preset_id") REFERENCES "public"."catalog_presets"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "preset_applications_salon_id_applied_at_idx"
  ON "preset_applications" USING btree ("salon_id","applied_at");
CREATE INDEX IF NOT EXISTS "preset_applications_preset_id_idx"
  ON "preset_applications" USING btree ("preset_id");
