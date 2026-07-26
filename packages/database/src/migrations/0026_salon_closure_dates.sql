CREATE TABLE "salon_closure_dates" (
  "salon_id" uuid NOT NULL,
  "date" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "salon_closure_dates_salon_id_date_pk" PRIMARY KEY("salon_id","date"),
  CONSTRAINT "salon_closure_dates_salon_id_organization_id_fk" FOREIGN KEY ("salon_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action
);
