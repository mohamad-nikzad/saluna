ARG NODE_VERSION=22.12.0
ARG NODE_IMAGE=node:${NODE_VERSION}-alpine
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
COPY apps/pwa/package.json ./apps/pwa/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/brand/package.json ./packages/brand/package.json
COPY packages/brand-tokens/package.json ./packages/brand-tokens/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/salon-core/package.json ./packages/salon-core/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/ui/package.json ./packages/ui/package.json

RUN pnpm install --frozen-lockfile --filter @repo/pwa...

FROM deps AS build

COPY apps/pwa ./apps/pwa
COPY packages/api-client ./packages/api-client
COPY packages/brand ./packages/brand
COPY packages/brand-tokens ./packages/brand-tokens
COPY packages/database ./packages/database
COPY packages/salon-core ./packages/salon-core
COPY packages/typescript-config ./packages/typescript-config
COPY packages/ui ./packages/ui

ARG VITE_API_BASE_URL=https://api.saluna.ir
ARG VITE_APP_URL=https://app.saluna.ir
ARG VITE_WEB_URL=https://saluna.ir
ARG VITE_PWA_ASSET_VERSION=

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL} \
  VITE_APP_URL=${VITE_APP_URL} \
  VITE_WEB_URL=${VITE_WEB_URL} \
  VITE_PWA_ASSET_VERSION=${VITE_PWA_ASSET_VERSION}

RUN pnpm --filter @repo/pwa build

FROM ${NGINX_IMAGE} AS runner

COPY apps/pwa/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/pwa/dist /usr/share/nginx/html

EXPOSE 80
