ARG NODE_IMAGE=node:22.12.0-alpine
ARG NGINX_IMAGE=nginx:1.27-alpine

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

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/eslint-config/package.json ./packages/eslint-config/package.json
COPY packages/notifications/package.json ./packages/notifications/package.json
COPY packages/salon-core/package.json ./packages/salon-core/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json

RUN pnpm install --frozen-lockfile --filter @repo/admin...

FROM deps AS build

COPY apps/admin ./apps/admin
COPY packages/api-client ./packages/api-client
COPY packages/auth ./packages/auth
COPY packages/database ./packages/database
COPY packages/eslint-config ./packages/eslint-config
COPY packages/notifications ./packages/notifications
COPY packages/salon-core ./packages/salon-core
COPY packages/typescript-config ./packages/typescript-config

RUN pnpm --filter @repo/admin build

FROM ${NGINX_IMAGE} AS runner

COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80
