#!/usr/bin/env bash
set -euo pipefail

# Run after starting Postgres. Password goes through the container environment,
# not command arguments or generated SQL files. Safe to rerun for key rotation.
ENV_FILE="${ENV_FILE:-.env.production}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi
: "${CMS_POSTGRES_PASSWORD:?Set CMS_POSTGRES_PASSWORD}"
export CMS_POSTGRES_PASSWORD

docker compose --env-file "$ENV_FILE" -f "${COMPOSE_FILE:-docker-compose.prod.yml}" \
  exec -T -e CMS_POSTGRES_PASSWORD postgres sh -c \
  'exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<'SQL'
\getenv cms_password CMS_POSTGRES_PASSWORD
\getenv operational_database POSTGRES_DB
\getenv operational_role POSTGRES_USER
DO $$
BEGIN
  IF current_database() = 'saluna_cms' OR current_user = 'saluna_cms' THEN
    RAISE EXCEPTION 'CMS and operational databases/roles must be separate';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
             WHERE r.rolname = 'saluna_cms') THEN
    RAISE EXCEPTION 'Remove existing saluna_cms role memberships before provisioning';
  END IF;
END $$;
SELECT 'CREATE ROLE saluna_cms LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'saluna_cms') \gexec
SELECT format('ALTER ROLE saluna_cms WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'cms_password') \gexec
SELECT 'CREATE DATABASE saluna_cms OWNER saluna_cms'
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'saluna_cms') \gexec
ALTER DATABASE saluna_cms OWNER TO saluna_cms;
REVOKE ALL ON DATABASE saluna_cms FROM PUBLIC;
GRANT CONNECT, CREATE, TEMPORARY ON DATABASE saluna_cms TO saluna_cms;
-- A new Postgres database grants CONNECT to PUBLIC. Remove that inherited
-- permission so the CMS login cannot even open the operational database.
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC, saluna_cms', :'operational_database') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'operational_database', :'operational_role') \gexec
\connect saluna_cms
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO saluna_cms;
SQL
echo 'CMS database and isolated login role provisioned.'
