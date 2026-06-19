#!/usr/bin/env bash
set -euo pipefail

ROOT="${ROOT:-$(pwd)}"
cd "$ROOT"

usage() {
  cat <<'USAGE'
Usage: scripts/deploy-registry-app.sh api|web|pwa IMAGE_TAG

Run this on the VPS from /opt/saluna after CI has pushed one app image.
It updates that app's deployment state, pulls only that image, restarts only
that service, and runs the relevant smoke check.

Required (one of):
  SALUNA_IMAGE_REGISTRY       Default registry/repository prefix, e.g.
                              registry.hamdocker.ir/my-team/
  SALUNA_<APP>_IMAGE_REGISTRY Per-app override used by multi-registry CI/CD.

Optional:
  ENV_FILE                Env file to update (default: .env.production)
  COMPOSE_FILE            Compose file (default: docker-compose.prod.yml)
  SALUNA_API_VERSION      API app version to persist
  SALUNA_API_IMAGE_REGISTRY
  SALUNA_WEB_VERSION      Web app version to persist
  SALUNA_WEB_IMAGE_REGISTRY
  SALUNA_PWA_VERSION      PWA app version to persist
  SALUNA_PWA_IMAGE_REGISTRY
  SKIP_BACKUP             Skip API pre-migration backup when set to 1
  SEED_CATALOG_PRESETS    Seed presets on API deploy (default: 1)
USAGE
}

app="${1:-}"
image_tag="${2:-}"

case "$app" in
  api | web | pwa) ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

if [[ -z "$image_tag" ]]; then
  usage >&2
  exit 1
fi

case "$app" in
  api) registry_var="SALUNA_API_IMAGE_REGISTRY" ;;
  web) registry_var="SALUNA_WEB_IMAGE_REGISTRY" ;;
  pwa) registry_var="SALUNA_PWA_IMAGE_REGISTRY" ;;
esac

# An explicit per-app registry selects a non-default CI/CD path. Legacy callers
# that only set SALUNA_IMAGE_REGISTRY intentionally keep using that global
# registry, even after another pipeline persisted a per-app registry.
registry_override_set=0
registry_override_value=""
if [[ -n "${!registry_var+x}" ]]; then
  registry_override_set=1
  registry_override_value="${!registry_var}"
fi

ENV_FILE="${ENV_FILE:-.env.production}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
SKIP_BACKUP="${SKIP_BACKUP:-0}"
SEED_CATALOG_PRESETS="${SEED_CATALOG_PRESETS:-1}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing ${ENV_FILE}. Run from /opt/saluna or set ENV_FILE." >&2
  exit 1
fi

preserved_env_keys=(
  API_DOMAIN
  APP_DOMAIN
  PUBLIC_DOMAIN
  SALUNA_API_VERSION
  SALUNA_API_IMAGE_REGISTRY
  SALUNA_IMAGE_REGISTRY
  SALUNA_PWA_VERSION
  SALUNA_PWA_IMAGE_REGISTRY
  SALUNA_WEB_VERSION
  SALUNA_WEB_IMAGE_REGISTRY
)
preserved_env_values=()
for key in "${preserved_env_keys[@]}"; do
  if [[ -n "${!key+x}" ]]; then
    preserved_env_values+=("${key}=${!key}")
  fi
done

set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

for preserved_env_value in "${preserved_env_values[@]}"; do
  export "$preserved_env_value"
done

if [[ "$registry_override_set" == "1" ]]; then
  registry_value="$registry_override_value"
else
  registry_value="${SALUNA_IMAGE_REGISTRY:-}"
fi

if [[ -z "$registry_value" ]]; then
  echo "${registry_var} or SALUNA_IMAGE_REGISTRY is required." >&2
  exit 1
fi

registry_value="${registry_value%/}/"
export "$registry_var=$registry_value"

set_env_value() {
  local key="$1"
  local value="$2"
  local file="$3"
  local tmp
  tmp="$(mktemp)"
  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    $0 ~ "^[[:space:]]*#" { print; next }
    $0 ~ "^" key "=" { print key "=" value; found = 1; next }
    { print }
    END { if (found == 0) print key "=" value }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
}

compose() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

backup_database() {
  if [[ "$SKIP_BACKUP" == "1" ]]; then
    echo "Skipping backup because SKIP_BACKUP=1"
    return
  fi

  mkdir -p backups
  local backup_file="backups/saluna-pre-api-deploy-${image_tag}-$(date +%Y%m%d-%H%M%S).sql.gz"
  echo "Writing pre-migration backup to ${backup_file}"
  docker exec saluna-postgres sh -c \
    'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
    | gzip -c > "$backup_file"
}

wait_for_postgres() {
  echo "Waiting for Postgres to become ready"
  for _ in $(seq 1 60); do
    if docker exec saluna-postgres pg_isready \
      -U "${POSTGRES_USER:-saluna}" \
      -d "${POSTGRES_DB:-saluna}" >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done

  echo "Postgres did not become ready in time." >&2
  exit 1
}

wait_for_service_health() {
  local service="$1"
  local container="saluna-${service}"

  echo "Waiting for ${service} to become healthy"
  for _ in $(seq 1 60); do
    local status
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"

    if [[ "$status" == "healthy" ]]; then
      return
    fi

    if [[ "$status" == "exited" || "$status" == "dead" ]]; then
      echo "${service} stopped while waiting for health." >&2
      compose ps "$service" >&2 || true
      compose logs --tail=80 "$service" >&2 || true
      exit 1
    fi

    sleep 2
  done

  echo "${service} did not become healthy in time." >&2
  compose ps "$service" >&2 || true
  compose logs --tail=80 "$service" >&2 || true
  exit 1
}

smoke_check() {
  local host="$1"
  local path="$2"
  local service="${3:-}"

  echo "Smoke check: ${host}${path}"
  for attempt in $(seq 1 15); do
    if compose exec -T gateway wget -q -O /dev/null \
      --header="Host: ${host}" \
      "http://127.0.0.1${path}"; then
      return
    fi

    if [[ "$attempt" -lt 15 ]]; then
      sleep 2
    fi
  done

  echo "Smoke check failed after retries: ${host}${path}" >&2
  compose ps >&2 || true
  compose logs --tail=80 gateway >&2 || true
  if [[ -n "$service" && "$service" != "gateway" ]]; then
    compose logs --tail=80 "$service" >&2 || true
  fi
  exit 1
}

case "$app" in
  api)
    tag_var="SALUNA_API_IMAGE_TAG"
    version_var="SALUNA_API_VERSION"
    version_value="${SALUNA_API_VERSION:-}"
    smoke_host="${API_DOMAIN:-api.saluna.ir}"
    smoke_path="/health"
    ;;
  web)
    tag_var="SALUNA_WEB_IMAGE_TAG"
    version_var="SALUNA_WEB_VERSION"
    version_value="${SALUNA_WEB_VERSION:-}"
    smoke_host="${PUBLIC_DOMAIN:-saluna.ir}"
    smoke_path="/"
    ;;
  pwa)
    tag_var="SALUNA_PWA_IMAGE_TAG"
    version_var="SALUNA_PWA_VERSION"
    version_value="${SALUNA_PWA_VERSION:-}"
    smoke_host="${APP_DOMAIN:-app.saluna.ir}"
    smoke_path="/healthz"
    ;;
esac

export "$tag_var=$image_tag"

echo "Pulling ${app} image tagged ${image_tag}"
compose pull "$app"

if [[ "$app" == "api" ]]; then
  echo "Starting Postgres"
  compose up -d postgres
  wait_for_postgres
  backup_database

  echo "Applying database migrations"
  compose run --rm api node apps/api/dist/migrate.cjs

  if [[ "$SEED_CATALOG_PRESETS" == "1" ]]; then
    echo "Seeding catalog presets"
    compose run --rm api node apps/api/dist/seed-catalog-presets.cjs
  fi
fi

echo "Restarting ${app}"
compose up -d --no-deps "$app"
wait_for_service_health "$app"

echo "Ensuring gateway is running"
compose up -d --no-deps gateway
wait_for_service_health gateway

smoke_check "$smoke_host" "$smoke_path" "$app"

set_env_value "$tag_var" "$image_tag" "$ENV_FILE"
set_env_value "$registry_var" "$registry_value" "$ENV_FILE"
if [[ -n "$version_value" ]]; then
  set_env_value "$version_var" "$version_value" "$ENV_FILE"
fi

echo "Deployed ${app}: ${image_tag}"
