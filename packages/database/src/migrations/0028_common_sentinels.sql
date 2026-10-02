DROP INDEX "client_follow_ups_salon_id_client_id_reason_unique";--> statement-breakpoint
ALTER TABLE "client_follow_ups" ADD COLUMN "occurrence_year" smallint;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "birth_date" date;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "source_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "client_follow_ups_non_birthday_unique" ON "client_follow_ups" USING btree ("salon_id","client_id","reason") WHERE "client_follow_ups"."reason" <> 'birthday';--> statement-breakpoint
CREATE UNIQUE INDEX "client_follow_ups_birthday_occurrence_unique" ON "client_follow_ups" USING btree ("salon_id","client_id","reason","occurrence_year","due_date") WHERE "client_follow_ups"."reason" = 'birthday';--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_type_source_key_unique" ON "notifications" USING btree ("user_id","type","source_key") WHERE "notifications"."source_key" is not null;
