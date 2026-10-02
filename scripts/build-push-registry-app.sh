#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'USAGE'
Usage: scripts/build-push-registry-app.sh api|web|pwa|admin

Builds one Saluna app image and pushes it to a registry.

Required:
  SALUNA_IMAGE_REGISTRY   Registry/repository prefix, e.g.
                          registry.hamdocker.ir/my-team/

Optional:
  ENV_FILE                Env file to load first (default: .env.production)
  DOCKER_PLATFORM         Target platform (default: linux/amd64)
  SALUNA_NODE_IMAGE       Node base image (default: node:22.12.0-alpine)
  SALUNA_NGINX_IMAGE      Nginx base image for PWA (default: nginx:1.27-alpine)
  SALUNA_ALPINE_MIRROR    Alpine repository mirror URL
  SALUNA_NPM_REGISTRY     npm registry URL
  SALUNA_PNPM_VERSION     pnpm version (default: 9.15.9)
  SALUNA_API_IMAGE_TAG    Explicit API tag
  SALUNA_WEB_IMAGE_TAG    Explicit web tag
  SALUNA_PWA_IMAGE_TAG    Explicit PWA tag
  SALUNA_ADMIN_IMAGE_TAG  Explicit admin tag
  SALUNA_SOURCE_URL       OCI source label
USAGE
}

app="${1:-}"
case "$app" in
  api | web | pwa | admin) ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

ENV_FILE="${ENV_FILE:-.env.production}"
DOCKER_PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"

if [[ -f "$ENV_FILE" ]]; then
  preserved_env_keys=(
    DOCKER_PLATFORM
    PUBLIC_API_URL
    PUBLIC_APP_URL
    SALUNA_API_IMAGE_TAG
    SALUNA_ADMIN_IMAGE_TAG
    SALUNA_ALPINE_MIRROR
    SALUNA_IMAGE_REGISTRY
    SALUNA_NGINX_IMAGE
    SALUNA_NODE_IMAGE
    SALUNA_NPM_REGISTRY
    SALUNA_PNPM_VERSION
    SALUNA_PWA_IMAGE_TAG
    SALUNA_SOURCE_URL
    SALUNA_WEB_IMAGE_TAG
    VITE_API_BASE_URL
    VITE_APP_URL
    VITE_PWA_ASSET_VERSION
    VITE_WEB_URL
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
fi

if [[ -z "${SALUNA_IMAGE_REGISTRY:-}" ]]; then
  echo "SALUNA_IMAGE_REGISTRY is required, e.g. registry.hamdocker.ir/my-team/" >&2
  exit 1
fi

registry="${SALUNA_IMAGE_REGISTRY%/}/"
git_sha="$(git rev-parse HEAD)"
short_sha="$(git rev-parse --short=7 HEAD)"
version="$(node -e "console.log(require('./apps/${app}/package.json').version)")"
default_tag="${version}-${short_sha}"

common_build_args=(
  --build-arg "NODE_IMAGE=${SALUNA_NODE_IMAGE:-node:22.12.0-alpine}"
  --build-arg "ALPINE_MIRROR=${SALUNA_ALPINE_MIRROR:-}"
  --build-arg "NPM_REGISTRY=${SALUNA_NPM_REGISTRY:-}"
  --build-arg "PNPM_VERSION=${SALUNA_PNPM_VERSION:-9.15.9}"
)

case "$app" in
  api)
    image_name="saluna-api"
    image_tag="${SALUNA_API_IMAGE_TAG:-$default_tag}"
    dockerfile="apps/api/Dockerfile"
    build_args=()
    ;;
  web)
    image_name="saluna-web"
    image_tag="${SALUNA_WEB_IMAGE_TAG:-$default_tag}"
    dockerfile="apps/web/Dockerfile"
    build_args=(
      --build-arg "PUBLIC_APP_URL=${PUBLIC_APP_URL:-https://saluna.ir}"
      --build-arg "PUBLIC_API_URL=${PUBLIC_API_URL:-https://api.saluna.ir}"
    )
    ;;
  pwa)
    image_name="saluna-pwa"
    image_tag="${SALUNA_PWA_IMAGE_TAG:-$default_tag}"
    dockerfile="apps/pwa/Dockerfile"
    build_args=(
      --build-arg "NGINX_IMAGE=${SALUNA_NGINX_IMAGE:-nginx:1.27-alpine}"
      --build-arg "VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://api.saluna.ir}"
      --build-arg "VITE_APP_URL=${VITE_APP_URL:-https://app.saluna.ir}"
      --build-arg "VITE_WEB_URL=${VITE_WEB_URL:-https://saluna.ir}"
      --build-arg "VITE_PWA_ASSET_VERSION=${VITE_PWA_ASSET_VERSION:-$image_tag}"
    )
    ;;
  admin)
    image_name="saluna-admin"
    image_tag="${SALUNA_ADMIN_IMAGE_TAG:-$default_tag}"
    dockerfile="apps/admin/Dockerfile"
    build_args=(
      --build-arg "NGINX_IMAGE=${SALUNA_NGINX_IMAGE:-nginx:1.27-alpine}"
    )
    ;;
esac

image="${registry}${image_name}:${image_tag}"

echo "Building ${image}"
docker build \
  --platform "$DOCKER_PLATFORM" \
  -f "$dockerfile" \
  --label "org.opencontainers.image.title=${image_name}" \
  --label "org.opencontainers.image.version=${version}" \
  --label "org.opencontainers.image.revision=${git_sha}" \
  --label "org.opencontainers.image.source=${SALUNA_SOURCE_URL:-}" \
  "${common_build_args[@]}" \
  "${build_args[@]}" \
  -t "$image" \
  .

echo "Pushing ${image}"
docker push "$image"

echo "Pushed ${app}:"
echo "  image: ${image}"
echo "  version: ${version}"
echo "  revision: ${git_sha}"
