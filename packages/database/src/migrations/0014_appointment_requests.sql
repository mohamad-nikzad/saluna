CREATE TABLE IF NOT EXISTS "salon_public_settings" (
  "salon_id" uuid PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "logo_url" text,
  "banner_url" text,
  "bio_text" text,
  "accent_color" text,
  "appointment_requests_enabled" boolean DEFAULT true NOT NULL,
  "deposit_policy" jsonb,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "salon_public_settings"
    ADD CONSTRAINT "salon_public_settings_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "service_public_visibility" (
  "salon_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "visible" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "service_public_visibility_salon_id_service_id_pk" PRIMARY KEY ("salon_id", "service_id")
);

DO $$ BEGIN
  ALTER TABLE "service_public_visibility"
    ADD CONSTRAINT "service_public_visibility_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "service_public_visibility"
    ADD CONSTRAINT "service_public_visibility_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "service_public_visibility_salon_id_sort_idx"
  ON "service_public_visibility" USING btree ("salon_id","sort_order");

CREATE TABLE IF NOT EXISTS "appointment_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "salon_id" uuid NOT NULL,
  "service_id" uuid NOT NULL,
  "staff_id" uuid,
  "requested_date" text NOT NULL,
  "requested_start_time" text NOT NULL,
  "requested_end_time" text NOT NULL,
  "customer_name" text NOT NULL,
  "customer_phone" text NOT NULL,
  "notes" text,
  "booked_service_name" text NOT NULL,
  "booked_service_duration" integer NOT NULL,
  "booked_service_price" integer NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "payment_status" text DEFAULT 'none' NOT NULL,
  "deposit_amount" integer,
  "confirmation_token" uuid DEFAULT gen_random_uuid() NOT NULL,
  "reviewed_by_user_id" uuid,
  "reviewed_at" timestamp with time zone,
  "rejection_reason" text,
  "appointment_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "appointment_requests"
    ADD CONSTRAINT "appointment_requests_salon_id_salons_id_fk"
    FOREIGN KEY ("salon_id") REFERENCES "public"."salons"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_requests"
    ADD CONSTRAINT "appointment_requests_service_id_services_id_fk"
    FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_requests"
    ADD CONSTRAINT "appointment_requests_staff_id_users_id_fk"
    FOREIGN KEY ("staff_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_requests"
    ADD CONSTRAINT "appointment_requests_reviewed_by_user_id_users_id_fk"
    FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "appointment_requests"
    ADD CONSTRAINT "appointment_requests_appointment_id_appointments_id_fk"
    FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "appointment_requests_confirmation_token_unique"
  ON "appointment_requests" USING btree ("confirmation_token");
CREATE INDEX IF NOT EXISTS "appointment_requests_salon_id_status_date_idx"
  ON "appointment_requests" USING btree ("salon_id","status","requested_date");
CREATE INDEX IF NOT EXISTS "appointment_requests_salon_id_customer_phone_idx"
  ON "appointment_requests" USING btree ("salon_id","customer_phone");

CREATE TABLE IF NOT EXISTS "public_submit_rate_limits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "ip" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "public_submit_rate_limits_ip_created_at_idx"
  ON "public_submit_rate_limits" USING btree ("ip","created_at");
