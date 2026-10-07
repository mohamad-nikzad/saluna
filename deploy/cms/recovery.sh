#!/usr/bin/env bash
# Consistent recovery points for the isolated local CMS rehearsal only.
set -euo pipefail
umask 077
MODE=${1:?Usage: recovery.sh backup-or-restore private-env private-backup-directory}
ENV_FILE=${2:?Supply the private environment file}
BACKUP_DIR=${3:?Supply the private backup directory}
COMPOSE_FILE=${COMPOSE_FILE:-$(cd "$(dirname "$0")" && pwd)/rehearsal.compose.yml}
[[ "$ENV_FILE" = /* && "$BACKUP_DIR" = /* ]] || { echo 'Use absolute private paths' >&2; exit 1; }
set -a
source "$ENV_FILE"
set +a
[[ ${COMPOSE_PROJECT_NAME:-} = saluna-cms-bl0087-* ]] || { echo 'Use a dedicated BL-0087 rehearsal project' >&2; exit 1; }
[[ ${EMDASH_ENCRYPTION_KEY:-} = emdash_enc_v1_* ]] || { echo 'Missing persisted encryption key' >&2; exit 1; }
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")
MEDIA_VOLUME="${COMPOSE_PROJECT_NAME}_cms_media"

case "$MODE" in
  backup)
    [[ ! -e "$BACKUP_DIR" ]] || { echo 'Refusing to overwrite a recovery point' >&2; exit 1; }
    mkdir -m 700 "$BACKUP_DIR"
    # Stop writes while the database and local media are copied together.
    "${COMPOSE[@]}" stop web
    trap '"${COMPOSE[@]}" up -d --wait web >/dev/null' EXIT
    "${COMPOSE[@]}" exec -T postgres pg_dump -U operator -d saluna_cms -Fc > "$BACKUP_DIR/database.dump"
    docker run --rm -v "$MEDIA_VOLUME:/media:ro" -v "$BACKUP_DIR:/backup" postgres:16-alpine \
      tar -C /media -czf /backup/media.tar.gz .
    printf '%s\n' "$EMDASH_ENCRYPTION_KEY" > "$BACKUP_DIR/encryption-key"
    docker image inspect "$CMS_REHEARSAL_IMAGE" --format '{{json .Id}}' > "$BACKUP_DIR/image-id.json"
    printf '%s\n' "$CMS_REHEARSAL_IMAGE" > "$BACKUP_DIR/image-tag"
    chmod 600 "$BACKUP_DIR"/*
    echo 'Created quiesced database, local media, encryption-key and image recovery point'
    ;;
  restore)
    [[ -f "$BACKUP_DIR/database.dump" && -f "$BACKUP_DIR/media.tar.gz" && -f "$BACKUP_DIR/encryption-key" ]] || \
      { echo 'Incomplete recovery point' >&2; exit 1; }
    [[ "$(cat "$BACKUP_DIR/encryption-key")" = "$EMDASH_ENCRYPTION_KEY" ]] || \
      { echo 'Restore environment must use the backed-up encryption key' >&2; exit 1; }
    "${COMPOSE[@]}" up -d --wait postgres
    ENV_FILE="$ENV_FILE" COMPOSE_FILE="$COMPOSE_FILE" "$(dirname "$0")/../../scripts/provision-cms.sh"
    TABLES=$("${COMPOSE[@]}" exec -T postgres psql -U operator -d saluna_cms -Atqc \
      "SELECT count(*) FROM pg_tables WHERE schemaname='public'")
    [[ "$TABLES" = 0 ]] || { echo 'Restore requires a fresh empty CMS database' >&2; exit 1; }
    "${COMPOSE[@]}" create web
    # Empty directories can be seeded by the helper image; actual files or
    # symlinks mean this is an existing media archive and must not be replaced.
    docker run --rm -v "$MEDIA_VOLUME:/media" postgres:16-alpine sh -ec \
      'test -z "$(find /media -mindepth 1 ! -type d -print -quit)" || { echo "Restore requires an empty media volume" >&2; exit 1; }'
    "${COMPOSE[@]}" exec -T postgres pg_restore -U operator -d saluna_cms \
      --role=saluna_cms --no-owner --no-acl < "$BACKUP_DIR/database.dump"
    docker run --rm -v "$MEDIA_VOLUME:/media" -v "$BACKUP_DIR:/backup:ro" postgres:16-alpine sh -ec \
      'tar -C /media -xzf /backup/media.tar.gz; chown -R 1000:1000 /media'
    "${COMPOSE[@]}" up -d --wait web
    echo 'Restored database, media and matching key into the fresh rehearsal environment'
    ;;
  *) echo 'Choose backup or restore' >&2; exit 1 ;;
esac
