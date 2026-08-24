# Build context must be the REPO ROOT, not client/ — the Vite root is client/src but the
# workspace's package.json, lockfile, tsconfig, and the @shared alias (../shared) all live
# above client/. Build with:  docker build -f client/Dockerfile -t pika-client .
#
# VITE_API_BASE_URL is baked in at build time (Vite env vars are compile-time, not
# runtime) — pass it via --build-arg for a split-domain deployment where the API is not
# same-origin/proxied. Leave it unset for a same-origin deployment.
#
# PIKA_PUBLIC_SITE_URL, if passed, generates a real sitemap.xml/robots.txt for that exact
# domain before the build so Vite picks them up from client/public/ like any other static
# asset (see scripts/generate-sitemap.mjs). Leave it unset to ship without them rather
# than bake in a wrong domain.

FROM node:20-slim AS builder

WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsconfig.node.json vite.config.ts ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY shared ./shared
COPY client ./client
COPY scripts ./scripts

ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ARG PIKA_PUBLIC_SITE_URL=""
RUN if [ -n "$PIKA_PUBLIC_SITE_URL" ]; then PIKA_PUBLIC_SITE_URL=$PIKA_PUBLIC_SITE_URL node scripts/generate-sitemap.mjs; fi
RUN pnpm build


FROM nginx:1.27-alpine AS runtime

COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/dist/public /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/ >/dev/null || exit 1
