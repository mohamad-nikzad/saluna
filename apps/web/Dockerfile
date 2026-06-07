# Astro 6 SSR (@astrojs/node standalone) for air-gapped VPS deploy.
# Build from the monorepo root (see docs/VPS_AIRGAPPED_DEPLOYMENT.md):
#
#   docker build -f apps/web/Dockerfile -t saloon-web:1.0 .
#
# Optional build-time env for sitemap / astro:env (defaults exist in astro.config):
#
#   docker build -f apps/web/Dockerfile \
#     --build-arg PUBLIC_APP_URL=https://salon.example \
#     --build-arg PUBLIC_API_URL=https://api.example \
#     -t saloon-web:1.0 .
#
# Optional ROOT_ENV_FILES (comma-separated basenames under repo root), loaded by
# scripts/with-root-env.mjs during build — copy env files into the build stage first
# if you use this (e.g. CI secret mount).

ARG NODE_VERSION=22.12.0
ARG NODE_IMAGE=node:${NODE_VERSION}-alpine

FROM ${NODE_IMAGE} AS base

ARG ALPINE_MIRROR=
ARG NPM_REGISTRY=
ARG PNPM_VERSION=9.15.9

RUN if [ -n "$ALPINE_MIRROR" ]; then \
    sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${ALPINE_MIRROR%/}#g" /etc/apk/repositories; \
  fi \
  && apk add --no-cache libc6-compat \
  && if [ -n "$NPM_REGISTRY" ]; then npm config set registry "$NPM_REGISTRY"; fi \
  && npm install -g "pnpm@${PNPM_VERSION}"

WORKDIR /app

# --- Stage 1: install dependencies (minimal workspace slice) ---
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/api-client/package.json ./packages/api-client/
COPY packages/salon-core/package.json ./packages/salon-core/
COPY packages/typescript-config/package.json ./packages/typescript-config/

RUN pnpm install --frozen-lockfile --filter @repo/web...

# --- Stage 1 (continued): build ---
FROM deps AS build

COPY scripts/with-root-env.mjs ./scripts/
COPY packages/typescript-config ./packages/typescript-config
COPY packages/api-client ./packages/api-client
COPY packages/brand ./packages/brand
COPY packages/salon-core ./packages/salon-core
COPY apps/web ./apps/web

RUN mkdir -p node_modules/@repo \
  && ln -sfn ../../packages/api-client node_modules/@repo/api-client \
  && ln -sfn ../../packages/brand node_modules/@repo/brand \
  && ln -sfn ../../packages/typescript-config node_modules/@repo/typescript-config

ARG PUBLIC_APP_URL=http://localhost:3001
ARG PUBLIC_API_URL=http://localhost:3000
ARG PUBLIC_MANAGER_APP_URL=https://app.saluna.ir
ARG ROOT_ENV_FILES=
ENV PUBLIC_APP_URL=${PUBLIC_APP_URL} \
  PUBLIC_API_URL=${PUBLIC_API_URL} \
  PUBLIC_MANAGER_APP_URL=${PUBLIC_MANAGER_APP_URL} \
  ROOT_ENV_FILES=${ROOT_ENV_FILES} \
  NODE_ENV=production

# with-root-env.mjs loads ROOT_ENV_FILES from repo root when present
RUN pnpm --filter @repo/web build

# --- Stage 2: slim runtime image ---
FROM base AS runner

WORKDIR /app/apps/web

ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3001

# Hoisted node_modules at repo root; Node resolves from apps/web upward
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages/api-client /app/packages/api-client
COPY --from=build /app/packages/brand /app/packages/brand
COPY --from=build /app/packages/salon-core /app/packages/salon-core
COPY --from=build /app/packages/typescript-config /app/packages/typescript-config
COPY --from=build /app/apps/web/dist ./dist

USER node

EXPOSE 3001

CMD ["node", "dist/server/entry.mjs"]
