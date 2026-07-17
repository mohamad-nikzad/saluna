ALTER TABLE "service_package_tasks"
  DROP CONSTRAINT "service_package_tasks_appointment_id_appointments_id_fk";
--> statement-breakpoint
ALTER TABLE "service_package_tasks"
  ADD CONSTRAINT "service_package_tasks_appointment_id_appointments_id_fk"
  FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id")
  ON DELETE cascade ON UPDATE no action;
