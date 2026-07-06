CREATE TABLE "service_addon_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"addon_id" uuid NOT NULL,
	"scope_type" text NOT NULL,
	"scope_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_catalog_migration_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"issue_type" text NOT NULL,
	"legacy_service_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_package_bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"lead_staff_id" uuid NOT NULL,
	"date" text NOT NULL,
	"booked_package_name" text NOT NULL,
	"booked_package_price" integer NOT NULL,
	"status" text NOT NULL,
	"notes" text,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_package_components" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_package_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"package_booking_id" uuid NOT NULL,
	"package_component_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"appointment_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"salon_id" uuid NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"description" text,
	"color" text,
	"active" boolean DEFAULT true NOT NULL,
	"price_override" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"source_legacy_service_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_addon_scopes" ADD CONSTRAINT "service_addon_scopes_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_addon_scopes" ADD CONSTRAINT "service_addon_scopes_addon_id_service_addons_id_fk" FOREIGN KEY ("addon_id") REFERENCES "public"."service_addons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog_migration_issues" ADD CONSTRAINT "service_catalog_migration_issues_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_catalog_migration_issues" ADD CONSTRAINT "service_catalog_migration_issues_legacy_service_id_services_id_fk" FOREIGN KEY ("legacy_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_bookings" ADD CONSTRAINT "service_package_bookings_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_bookings" ADD CONSTRAINT "service_package_bookings_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_bookings" ADD CONSTRAINT "service_package_bookings_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_bookings" ADD CONSTRAINT "service_package_bookings_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_components" ADD CONSTRAINT "service_package_components_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_components" ADD CONSTRAINT "service_package_components_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_components" ADD CONSTRAINT "service_package_components_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_tasks" ADD CONSTRAINT "service_package_tasks_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_tasks" ADD CONSTRAINT "service_package_tasks_package_booking_id_service_package_bookings_id_fk" FOREIGN KEY ("package_booking_id") REFERENCES "public"."service_package_bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_tasks" ADD CONSTRAINT "service_package_tasks_package_component_id_service_package_components_id_fk" FOREIGN KEY ("package_component_id") REFERENCES "public"."service_package_components"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_tasks" ADD CONSTRAINT "service_package_tasks_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_package_tasks" ADD CONSTRAINT "service_package_tasks_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_category_id_service_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."service_categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_packages" ADD CONSTRAINT "service_packages_source_legacy_service_id_services_id_fk" FOREIGN KEY ("source_legacy_service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_addon_scopes_addon_type_scope_unique" ON "service_addon_scopes" USING btree ("addon_id","scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "service_addon_scopes_salon_id_addon_idx" ON "service_addon_scopes" USING btree ("salon_id","addon_id");--> statement-breakpoint
CREATE INDEX "service_addon_scopes_salon_id_scope_idx" ON "service_addon_scopes" USING btree ("salon_id","scope_type","scope_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_catalog_migration_issues_legacy_type_unique" ON "service_catalog_migration_issues" USING btree ("legacy_service_id","issue_type");--> statement-breakpoint
CREATE INDEX "service_catalog_migration_issues_salon_id_resolved_idx" ON "service_catalog_migration_issues" USING btree ("salon_id","resolved");--> statement-breakpoint
CREATE INDEX "service_package_bookings_salon_id_date_idx" ON "service_package_bookings" USING btree ("salon_id","date");--> statement-breakpoint
CREATE INDEX "service_package_bookings_salon_id_client_id_date_idx" ON "service_package_bookings" USING btree ("salon_id","client_id","date");--> statement-breakpoint
CREATE INDEX "service_package_bookings_salon_id_package_id_idx" ON "service_package_bookings" USING btree ("salon_id","package_id");--> statement-breakpoint
CREATE INDEX "service_package_bookings_salon_id_lead_staff_id_date_idx" ON "service_package_bookings" USING btree ("salon_id","lead_staff_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "service_package_components_package_service_unique" ON "service_package_components" USING btree ("package_id","service_id");--> statement-breakpoint
CREATE INDEX "service_package_components_salon_id_package_idx" ON "service_package_components" USING btree ("salon_id","package_id");--> statement-breakpoint
CREATE INDEX "service_package_components_salon_id_service_idx" ON "service_package_components" USING btree ("salon_id","service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_package_tasks_appointment_id_unique" ON "service_package_tasks" USING btree ("appointment_id");--> statement-breakpoint
CREATE INDEX "service_package_tasks_salon_id_booking_idx" ON "service_package_tasks" USING btree ("salon_id","package_booking_id");--> statement-breakpoint
CREATE INDEX "service_package_tasks_salon_id_staff_id_idx" ON "service_package_tasks" USING btree ("salon_id","staff_id");--> statement-breakpoint
CREATE INDEX "service_package_tasks_salon_id_service_id_idx" ON "service_package_tasks" USING btree ("salon_id","service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_packages_source_legacy_service_id_unique" ON "service_packages" USING btree ("source_legacy_service_id");--> statement-breakpoint
CREATE INDEX "service_packages_salon_id_active_idx" ON "service_packages" USING btree ("salon_id","active");--> statement-breakpoint
CREATE INDEX "service_packages_salon_id_category_id_idx" ON "service_packages" USING btree ("salon_id","category_id");--> statement-breakpoint
CREATE INDEX "service_packages_salon_id_sort_idx" ON "service_packages" USING btree ("salon_id","sort_order","name");--> statement-breakpoint
INSERT INTO "service_addon_scopes" ("salon_id", "addon_id", "scope_type", "scope_id")
SELECT "salon_id", "addon_id", 'category', "scope_id"
FROM "service_addon_category_scopes"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_addon_scopes" ("salon_id", "addon_id", "scope_type", "scope_id")
SELECT "salon_id", "addon_id", 'service', "scope_id"
FROM "service_addon_service_scopes"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_addon_scopes" ("salon_id", "addon_id", "scope_type", "scope_id")
SELECT DISTINCT family_scopes."salon_id", family_scopes."addon_id", 'service', services."id"
FROM "service_addon_family_scopes" family_scopes
INNER JOIN "services"
  ON services."salon_id" = family_scopes."salon_id"
  AND services."family_id" = family_scopes."scope_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_addon_scopes" ("salon_id", "addon_id", "scope_type", "scope_id")
SELECT addons."salon_id", addons."id", 'all', NULL
FROM "service_addons" addons
WHERE NOT EXISTS (
  SELECT 1 FROM "service_addon_category_scopes" category_scopes
  WHERE category_scopes."addon_id" = addons."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "service_addon_family_scopes" family_scopes
  WHERE family_scopes."addon_id" = addons."id"
)
AND NOT EXISTS (
  SELECT 1 FROM "service_addon_service_scopes" service_scopes
  WHERE service_scopes."addon_id" = addons."id"
);--> statement-breakpoint
WITH complete_combos AS (
  SELECT combo.*
  FROM "services" combo
  WHERE combo."kind" = 'combo'
    AND EXISTS (
      SELECT 1
      FROM "service_combo_components" component
      INNER JOIN "services" component_service
        ON component_service."id" = component."component_service_id"
        AND component_service."salon_id" = component."salon_id"
        AND component_service."kind" = 'standard'
      WHERE component."salon_id" = combo."salon_id"
        AND component."combo_service_id" = combo."id"
    )
)
INSERT INTO "service_packages" (
  "salon_id",
  "category_id",
  "name",
  "description",
  "color",
  "active",
  "price_override",
  "sort_order",
  "source_legacy_service_id",
  "created_at",
  "updated_at"
)
SELECT
  "salon_id",
  "category_id",
  "name",
  "description",
  "color",
  "active",
  CASE WHEN "price" > 0 THEN "price" ELSE NULL END,
  0,
  "id",
  "created_at",
  now()
FROM complete_combos
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_package_components" (
  "salon_id",
  "package_id",
  "service_id",
  "sort_order",
  "created_at",
  "updated_at"
)
SELECT
  combo_components."salon_id",
  packages."id",
  combo_components."component_service_id",
  combo_components."sort_order",
  combo_components."created_at",
  combo_components."updated_at"
FROM "service_combo_components" combo_components
INNER JOIN "service_packages" packages
  ON packages."source_legacy_service_id" = combo_components."combo_service_id"
INNER JOIN "services" component_service
  ON component_service."id" = combo_components."component_service_id"
  AND component_service."salon_id" = combo_components."salon_id"
  AND component_service."kind" = 'standard'
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "service_catalog_migration_issues" (
  "salon_id",
  "issue_type",
  "legacy_service_id",
  "details"
)
SELECT
  combo."salon_id",
  'legacy_combo_missing_components',
  combo."id",
  jsonb_build_object(
    'legacyServiceName', combo."name",
    'reason', 'Combo service had no valid standard components at migration time.'
  )
FROM "services" combo
WHERE combo."kind" = 'combo'
  AND NOT EXISTS (
    SELECT 1
    FROM "service_combo_components" component
    INNER JOIN "services" component_service
      ON component_service."id" = component."component_service_id"
      AND component_service."salon_id" = component."salon_id"
      AND component_service."kind" = 'standard'
    WHERE component."salon_id" = combo."salon_id"
      AND component."combo_service_id" = combo."id"
  )
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "services"
SET "active" = false
WHERE "kind" = 'combo';
