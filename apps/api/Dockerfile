ARG NODE_VERSION=22.16.0
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
ENV CI=true

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/brand/package.json ./packages/brand/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/notifications/package.json ./packages/notifications/package.json
COPY packages/salon-core/package.json ./packages/salon-core/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile --filter @repo/api...

FROM deps AS build

COPY scripts/with-root-env.mjs ./scripts/with-root-env.mjs
COPY apps/api ./apps/api
COPY packages/auth ./packages/auth
COPY packages/brand ./packages/brand
COPY packages/database ./packages/database
COPY packages/eslint-config ./packages/eslint-config
COPY packages/notifications ./packages/notifications
COPY packages/salon-core ./packages/salon-core
COPY packages/typescript-config ./packages/typescript-config

RUN pnpm --filter @repo/api build \
  && pnpm --filter @repo/api build:bundle

FROM ${NODE_IMAGE} AS runner

ARG ALPINE_MIRROR=

RUN if [ -n "$ALPINE_MIRROR" ]; then \
    sed -i "s#https://dl-cdn.alpinelinux.org/alpine#${ALPINE_MIRROR%/}#g" /etc/apk/repositories; \
  fi \
  && apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production \
  PORT=3002 \
  SALUNA_MIGRATIONS_DIR=/app/packages/database/src/migrations

COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/database/src/migrations ./packages/database/src/migrations

USER node

EXPOSE 3002

CMD ["node", "apps/api/dist/index.cjs"]
