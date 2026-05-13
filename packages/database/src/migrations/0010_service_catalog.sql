CREATE TABLE IF NOT EXISTS "service_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "service_families" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "category_id" uuid NOT NULL,
  "name" text NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  ALTER TABLE "service_categories"
    ADD CONSTRAINT "service_categories_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_families"
    ADD CONSTRAINT "service_families_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "service_families"
    ADD CONSTRAINT "service_families_category_id_service_categories_id_fk"
    FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "family_id" uuid;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'standard' NOT NULL;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "booked_service_name" text;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "booked_service_duration" integer;
ALTER TABLE "appointments" ADD COLUMN IF NOT EXISTS "booked_service_price" integer;

DO $$
BEGIN
  ALTER TABLE "services"
    ADD CONSTRAINT "services_family_id_service_families_id_fk"
    FOREIGN KEY ("family_id") REFERENCES "public"."service_families"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "service_categories_salon_id_name_unique"
  ON "service_categories" USING btree ("salon_id","name");
CREATE INDEX IF NOT EXISTS "service_categories_salon_id_active_idx"
  ON "service_categories" USING btree ("salon_id","active");
CREATE UNIQUE INDEX IF NOT EXISTS "service_families_salon_id_category_id_name_unique"
  ON "service_families" USING btree ("salon_id","category_id","name");
CREATE INDEX IF NOT EXISTS "service_families_salon_id_category_id_idx"
  ON "service_families" USING btree ("salon_id","category_id");
CREATE INDEX IF NOT EXISTS "service_families_salon_id_active_idx"
  ON "service_families" USING btree ("salon_id","active");
CREATE INDEX IF NOT EXISTS "services_salon_id_family_id_idx"
  ON "services" USING btree ("salon_id","family_id");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'services'
      AND column_name = 'category'
  ) THEN
    INSERT INTO "service_categories" ("salon_id", "name", "active")
    SELECT DISTINCT
      "salon_id",
      CASE "category"
        WHEN 'hair' THEN 'مو'
        WHEN 'nails' THEN 'ناخن'
        WHEN 'skincare' THEN 'پوست'
        WHEN 'spa' THEN 'اسپا'
        ELSE 'خدمات'
      END,
      true
    FROM "services"
    WHERE "family_id" IS NULL
    ON CONFLICT ("salon_id", "name") DO NOTHING;

    INSERT INTO "service_families" ("salon_id", "category_id", "name", "active")
    SELECT DISTINCT
      "services"."salon_id",
      "service_categories"."id",
      CASE "services"."category"
        WHEN 'hair' THEN 'خدمات مو'
        WHEN 'nails' THEN 'خدمات ناخن'
        WHEN 'skincare' THEN 'خدمات پوست'
        WHEN 'spa' THEN 'خدمات اسپا'
        ELSE 'خدمات عمومی'
      END,
      true
    FROM "services"
    INNER JOIN "service_categories"
      ON "service_categories"."salon_id" = "services"."salon_id"
      AND "service_categories"."name" = CASE "services"."category"
        WHEN 'hair' THEN 'مو'
        WHEN 'nails' THEN 'ناخن'
        WHEN 'skincare' THEN 'پوست'
        WHEN 'spa' THEN 'اسپا'
        ELSE 'خدمات'
      END
    WHERE "services"."family_id" IS NULL
    ON CONFLICT ("salon_id", "category_id", "name") DO NOTHING;

    UPDATE "services"
    SET "family_id" = "service_families"."id"
    FROM "service_families"
    INNER JOIN "service_categories"
      ON "service_categories"."id" = "service_families"."category_id"
    WHERE "services"."family_id" IS NULL
      AND "service_families"."salon_id" = "services"."salon_id"
      AND "service_categories"."salon_id" = "services"."salon_id"
      AND "service_categories"."name" = CASE "services"."category"
        WHEN 'hair' THEN 'مو'
        WHEN 'nails' THEN 'ناخن'
        WHEN 'skincare' THEN 'پوست'
        WHEN 'spa' THEN 'اسپا'
        ELSE 'خدمات'
      END
      AND "service_families"."name" = CASE "services"."category"
        WHEN 'hair' THEN 'خدمات مو'
        WHEN 'nails' THEN 'خدمات ناخن'
        WHEN 'skincare' THEN 'خدمات پوست'
        WHEN 'spa' THEN 'خدمات اسپا'
        ELSE 'خدمات عمومی'
      END;
  END IF;
END $$;

UPDATE "appointments"
SET
  "booked_service_name" = "services"."name",
  "booked_service_duration" = "services"."duration",
  "booked_service_price" = "services"."price"
FROM "services"
WHERE "appointments"."service_id" = "services"."id"
  AND "appointments"."salon_id" = "services"."salon_id"
  AND (
    "appointments"."booked_service_name" IS NULL
    OR "appointments"."booked_service_duration" IS NULL
    OR "appointments"."booked_service_price" IS NULL
  );

ALTER TABLE "appointments" ALTER COLUMN "booked_service_name" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "booked_service_duration" SET NOT NULL;
ALTER TABLE "appointments" ALTER COLUMN "booked_service_price" SET NOT NULL;
ALTER TABLE "services" ALTER COLUMN "family_id" SET NOT NULL;
ALTER TABLE "services" DROP COLUMN IF EXISTS "category";
