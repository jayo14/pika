# Pika

Pika is a consent-based Discord community intelligence workspace. It helps an authorized
server administrator or workspace member find a small number of useful, legitimately
available conversations and community changes, understand *why* each one is relevant, and
save it for a human follow-up.

> Show users fewer, better things — not more Discord data.

Pika is not a scraper, a user-session automation tool, a member-export tool, or an
autonomous outreach system. It only processes data reachable through official Discord
mechanisms (OAuth + an administrator-installed bot with an explicit channel allowlist),
and only for the disclosed, authorized purpose. See `docs/discord-capabilities.md` and
`docs/security.md`.

## What's here

```text
api/        FastAPI backend — auth, workspaces, Discord OAuth, monitors, the rule-based
            signal engine, full-text search, notifications, billing, admin API, Celery
            tasks, and the Discord Gateway connector
client/     React + Vite + TypeScript web app — session-cookie auth, dashboard, monitors,
            saved items, settings (integrations/notifications/billing/account), and a
            staff-only admin console
shared/     legacy shared TypeScript constants retained from an earlier migration
docs/       product, architecture, database, API, security, and deployment records —
            kept in sync with what's actually implemented, not aspirational
```

Both the backend and frontend are real, tested, and wired to each other — not a prototype
with mocked data. `docs/setup.md` and `docs/v1-roadmap.md` are explicit about the handful
of things that are schema-ready but not yet built (e.g. the opt-in community directory,
tagging on saved items).

## Quickstart (local development)

### 1. Clone

```bash
git clone <this-repo-url> pika
cd pika
```

### 2. Start Postgres + Redis

Use your own, or a disposable local container:

```bash
docker run -d --name pika-postgres -e POSTGRES_USER=pika \
  -e POSTGRES_PASSWORD=pika_dev_local -e POSTGRES_DB=pika \
  -p 5433:5432 postgres:16-alpine
# any local or containerized Redis works for REDIS_URL below
```

### 3. Fill in the env files

Two separate env files — the backend and the client each load their own:

```bash
cp api/.env.example api/.env        # backend: database, redis, auth, discord, stripe
cp .env.example .env.local          # client: only needed for a split-domain deployment
```

Edit `api/.env`: point `DATABASE_URL`/`REDIS_URL` at the services from step 2, and
generate a real `ENCRYPTION_KEY` (it must be a valid Fernet key, not an arbitrary
string — this encrypts Discord tokens and event content at rest):

```bash
cd api && uv sync --extra dev   # installs cryptography, needed by the script below
uv run python scripts/generate_encryption_key.py
```

Paste the output into `ENCRYPTION_KEY` in `api/.env`. `PIKA_SESSION_SECRET` can be any
random string (`openssl rand -base64 32` works). Leave `DISCORD_*` and `STRIPE_*` blank
for local development — the app runs fine without them; `GET /api/v1/capabilities`
reports what's configured. `.env.local` needs nothing filled in for local dev — the Vite
dev server proxies `/api/*` to the backend same-origin, so `VITE_API_BASE_URL` is only
required for a split-domain deployment (see `docs/deployment.md`).

### 4. Run the backend

```bash
cd api
uv run alembic upgrade head
uv run uvicorn app.main:app --reload    # http://localhost:8000
```

### 5. Run the client

```bash
# separate terminal, repo root
pnpm install
pnpm dev    # http://localhost:3000, proxies /api/* to the backend on :8000
```

Sign up at `http://localhost:3000/sign-up` and you're in. Full walkthrough, including the
Celery worker/beat and the Discord Gateway connector, is in `docs/setup.md`.

## Tests

```bash
cd api && uv run pytest      # runs against real local Postgres/Redis, not mocks —
                              # truncates whatever DATABASE_URL/REDIS_URL point at
cd api && uv run ruff check app tests
pnpm exec tsc --noEmit
```

## Stack

- **Backend**: Python, FastAPI, SQLAlchemy (async) + Alembic, PostgreSQL, Redis, Celery,
  discord.py. Dependency/build tool is `uv`.
- **Frontend**: React 19, Vite, TypeScript, wouter, TanStack Query, Tailwind + shadcn/ui.
- **Auth**: HttpOnly session cookies (Redis-backed), argon2 password hashing, Discord
  OAuth for server connection — never a Discord password or user token.

## Deployment

Docker images and a Render blueprint are included and documented in `docs/deployment.md`:

```text
api/Dockerfile          One image, four roles (api / worker / beat / gateway) selected
                         at runtime — see api/docker-entrypoint.sh
client/Dockerfile        nginx-served static build (build context is the repo root)
docker-compose.yml       Full self-hosted stack: postgres, redis, api, worker, beat,
                         gateway, client
render.yaml              Render Blueprint: managed Postgres + Redis, four Docker
                         services off the one API image, client as a static site
```

## Documentation

| Doc | Covers |
| --- | --- |
| `docs/product.md` | Product definition, customer segments, jobs-to-be-done |
| `docs/architecture.md` | System architecture, data flow, key decisions |
| `docs/database.md` | Schema, retention, tenant-isolation controls |
| `docs/api.md` | Endpoint reference — reflects what's actually implemented |
| `docs/discord-capabilities.md` | What's officially supported by Discord vs. excluded |
| `docs/security.md` | Auth, data minimization, prohibited behavior |
| `docs/deployment.md` | Docker Compose and Render deployment steps |
| `docs/setup.md` | Local development, migrations, running workers |
| `docs/v1-roadmap.md` | Phase-by-phase status — what's done vs. not started |
| `docs/risk-register.md` | Known technical/platform/privacy/business risks |
