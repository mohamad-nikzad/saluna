ALTER TABLE "user" ADD COLUMN "phone_number" text;
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "phone_number_verified" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "user"
SET
  "phone_number" = "username",
  "phone_number_verified" = true
WHERE "phone_number" IS NULL
  AND "username" ~ '^09[0-9]{9}$';
--> statement-breakpoint
CREATE UNIQUE INDEX "user_phone_number_unique" ON "user" USING btree ("phone_number");
