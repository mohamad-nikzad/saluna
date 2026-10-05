-- Publish the two synthetic salons so customer browser tests can reach them.
DO $$ BEGIN
  IF current_database() <> 'saluna_qa' OR current_user <> 'saluna_qa' THEN
    RAISE EXCEPTION 'QA fixtures require the isolated saluna_qa database and user';
  END IF;
END $$;

INSERT INTO salon_public_settings (salon_id, enabled, appointment_requests_enabled, enabled_messaging_providers)
SELECT id, true, true, ARRAY[]::text[] FROM organization WHERE slug IN ('saluna', 'niloufar')
ON CONFLICT (salon_id) DO UPDATE SET enabled = true, appointment_requests_enabled = true, enabled_messaging_providers = ARRAY[]::text[];
