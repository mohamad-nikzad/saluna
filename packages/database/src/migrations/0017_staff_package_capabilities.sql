CREATE TABLE "staff_package_capabilities" (
	"staff_id" uuid NOT NULL,
	"package_id" uuid NOT NULL,
	"salon_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_package_capabilities_staff_id_package_id_pk" PRIMARY KEY("staff_id","package_id")
);
--> statement-breakpoint
ALTER TABLE "staff_package_capabilities" ADD CONSTRAINT "staff_package_capabilities_package_id_service_packages_id_fk" FOREIGN KEY ("package_id") REFERENCES "public"."service_packages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff_package_capabilities" ADD CONSTRAINT "staff_package_capabilities_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staff_package_capabilities_package_id_idx" ON "staff_package_capabilities" USING btree ("package_id");--> statement-breakpoint
CREATE INDEX "staff_package_capabilities_salon_id_staff_id_idx" ON "staff_package_capabilities" USING btree ("salon_id","staff_id");--> statement-breakpoint
CREATE INDEX "staff_package_capabilities_salon_id_package_id_idx" ON "staff_package_capabilities" USING btree ("salon_id","package_id");--> statement-breakpoint
INSERT INTO "staff_package_capabilities" ("staff_id", "package_id", "salon_id")
SELECT staff_services."staff_user_id", packages."id", packages."salon_id"
FROM "staff_services" staff_services
INNER JOIN "service_packages" packages
  ON packages."source_legacy_service_id" = staff_services."service_id"
  AND packages."salon_id" = staff_services."salon_id"
ON CONFLICT DO NOTHING;--> statement-breakpoint
WITH active_staff AS (
  SELECT member."user_id" AS "staff_id", member."organization_id" AS "salon_id"
  FROM "member" member
  LEFT JOIN "salon_member" salon_member
    ON salon_member."user_id" = member."user_id"
    AND salon_member."organization_id" = member."organization_id"
  WHERE member."role" = 'member'
    AND (salon_member."active" IS NULL OR salon_member."active" = true)
  UNION
  SELECT staff_profiles."id" AS "staff_id", staff_profiles."salon_id"
  FROM "staff_profiles" staff_profiles
  WHERE staff_profiles."active" = true
    AND staff_profiles."user_id" IS NULL
),
unrestricted_staff AS (
  SELECT active_staff."staff_id", active_staff."salon_id"
  FROM active_staff
  WHERE NOT EXISTS (
    SELECT 1
    FROM "staff_services" staff_services
    WHERE staff_services."staff_user_id" = active_staff."staff_id"
      AND staff_services."salon_id" = active_staff."salon_id"
  )
)
INSERT INTO "staff_package_capabilities" ("staff_id", "package_id", "salon_id")
SELECT unrestricted_staff."staff_id", packages."id", packages."salon_id"
FROM unrestricted_staff
INNER JOIN "service_packages" packages
  ON packages."salon_id" = unrestricted_staff."salon_id"
ON CONFLICT DO NOTHING;
