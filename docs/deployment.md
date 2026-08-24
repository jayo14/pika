# Pika Deployment Guide

Pika ships as five deployable units, all built from `api/` except the client:

| Component | Image / build | Command | Notes |
| --- | --- | --- | --- |
| API | `api/Dockerfile` | `serve` (default `CMD`) | Runs Alembic migrations, then `uvicorn`. HTTP, needs a public URL. |
| Celery worker | `api/Dockerfile` (same image) | `worker` | Processes ingested events into signals (`app/workers/tasks.py`). |
| Celery beat | `api/Dockerfile` (same image) | `beat` | Hourly retention/purge schedule. Run exactly one instance. |
| Gateway connector | `api/Dockerfile` (same image) | `gateway` | Holds the live Discord websocket. Dry-runs and exits 0 if `DISCORD_BOT_TOKEN` is unset. |
| Client | `client/Dockerfile` (Docker) or Render static site | — | Static Vite build served by nginx (Docker) or Render's static hosting. |

Plus managed PostgreSQL and Redis — not built here, provisioned by the platform.

## Option A: Docker Compose (single host / self-hosted)

```bash
cp api/.env.example .env
# edit .env: at minimum set PIKA_SESSION_SECRET and ENCRYPTION_KEY
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
docker compose up --build
```

This starts Postgres, Redis, the API (migrates on boot), worker, beat, gateway (dry-run
without a bot token), and the client on `http://localhost:8080` — nginx proxies
`/api/*` to the API container same-origin, so no `VITE_API_BASE_URL` is needed for this
topology. See `docker-compose.yml` for the full service list.

To run only the images without compose:

```bash
docker build -f api/Dockerfile -t pika-api ./api
docker build -f client/Dockerfile -t pika-client .   # build context is the repo root
```

## Option B: Render (`render.yaml` blueprint)

Render deploys the API, worker, beat, and gateway as **separate services from the same
Dockerfile** (`dockerCommand` selects the role) plus a managed Postgres database, a managed
Redis-compatible key-value service, and the client as a Render static site.

1. Push this repo to GitHub/GitLab and create a Blueprint in the Render dashboard pointing
   at it (or run `render blueprint launch`).
2. Render provisions `pika-postgres`, `pika-redis`, `pika-api`, `pika-worker`,
   `pika-beat`, `pika-gateway`, and `pika-client` from `render.yaml`.
3. Fill in the `sync: false` variables in the Render dashboard (they are not committed —
   see `envVarGroups.pika-shared` in `render.yaml`): `ENCRYPTION_KEY` (must be a real
   Fernet key — generate it as shown above, Render's auto-generated secrets are plain
   random strings and will not work here), `PIKA_CORS_ORIGINS` (the client's Render URL),
   `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`/`DISCORD_REDIRECT_URI`/`DISCORD_BOT_TOKEN`,
   and `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` if billing is enabled.
4. Set `pika-client`'s `VITE_API_BASE_URL` to the API service's Render URL — the client and
   API are two different origins on Render, so unlike the Compose topology this must be
   set at build time (Vite env vars are compile-time, not runtime).
5. Because the client and API are cross-origin on Render, the session cookie is issued
   with `SameSite=None; Secure` whenever `PIKA_ENV=production` (see
   `api/app/core/sessions.py`) — this only works over HTTPS, which Render provides by
   default. Do not point `PIKA_CORS_ORIGINS` at an `http://` origin in production.
6. Redis note: `render.yaml` uses `type: keyvalue` (Render's current managed Redis-
   compatible offering). Blueprint schemas change — if that block fails to provision,
   delete it and point `REDIS_URL` at an external Redis (e.g. Upstash) instead.

## Configuration reference

See `api/.env.example` for the full variable list. `DATABASE_URL` and `REDIS_URL` are
wired automatically in both Compose and the Render blueprint; everything else is a secret
you provide. `PIKA_SESSION_SECRET` is currently only checked for presence
(`GET /api/v1/capabilities`), not used to sign anything, so any random value works.
`ENCRYPTION_KEY` is load-bearing — it encrypts Discord OAuth tokens and event content at
rest (`app/core/security.py`) — and must be a valid Fernet key, generated as shown above,
not an arbitrary string.

## Before enabling a real Discord connection

Complete: an external security review; OAuth redirect and consent copy review;
privileged-intent (Message Content) / Discord App Review assessment; a privacy/retention
and deletion-flow review; rate-limit and reconnect tests against the live Gateway; the
cross-tenant authorization tests in `api/tests/test_tenant_isolation.py`; and a dry run
against an administrator-owned test server with a narrow monitor and a small channel
allowlist before widening scope.
