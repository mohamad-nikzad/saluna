ALTER TABLE "appointment_requests" ADD COLUMN "client_id" uuid;
ALTER TABLE "appointment_requests" ADD COLUMN "timing_mode" text DEFAULT 'exact' NOT NULL;
ALTER TABLE "appointment_requests" ADD COLUMN "acceptable_dates" text[];
ALTER TABLE "appointment_requests" ADD COLUMN "time_preference" text;
ALTER TABLE "appointment_requests" ALTER COLUMN "requested_date" DROP NOT NULL;
ALTER TABLE "appointment_requests" ALTER COLUMN "requested_start_time" DROP NOT NULL;
ALTER TABLE "appointment_requests" ALTER COLUMN "requested_end_time" DROP NOT NULL;
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "appointment_requests" ADD CONSTRAINT "appointment_requests_timing_mode_check" CHECK (
  ("timing_mode" = 'exact' AND "requested_date" IS NOT NULL AND "requested_start_time" IS NOT NULL AND "requested_end_time" IS NOT NULL AND "acceptable_dates" IS NULL AND "time_preference" IS NULL)
  OR
  ("timing_mode" = 'flexible' AND "client_id" IS NOT NULL AND "requested_date" IS NULL AND "requested_start_time" IS NULL AND "requested_end_time" IS NULL AND cardinality("acceptable_dates") > 0 AND "time_preference" IN ('morning', 'afternoon', 'evening', 'any'))
);
