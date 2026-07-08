DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff_package_capabilities'
      AND column_name = 'staff_user_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'staff_package_capabilities'
      AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE "staff_package_capabilities" RENAME COLUMN "staff_user_id" TO "staff_id";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_package_capabilities_staff_user_id_package_id_pk'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'staff_package_capabilities_staff_id_package_id_pk'
  ) THEN
    ALTER TABLE "staff_package_capabilities"
      RENAME CONSTRAINT "staff_package_capabilities_staff_user_id_package_id_pk"
      TO "staff_package_capabilities_staff_id_package_id_pk";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'staff_package_capabilities_salon_id_staff_user_id_idx'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'i'
      AND relname = 'staff_package_capabilities_salon_id_staff_id_idx'
  ) THEN
    ALTER INDEX "staff_package_capabilities_salon_id_staff_user_id_idx"
      RENAME TO "staff_package_capabilities_salon_id_staff_id_idx";
  END IF;
END $$;
