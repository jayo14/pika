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

```bash
# 1. Postgres + Redis (or use your own)
docker run -d --name pika-postgres -e POSTGRES_USER=pika \
  -e POSTGRES_PASSWORD=pika_dev_local -e POSTGRES_DB=pika \
  -p 5433:5432 postgres:16-alpine

# 2. Backend
cd api
cp .env.example .env   # point DATABASE_URL/REDIS_URL at the services above; see below
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# 3. Frontend (separate terminal, repo root)
pnpm install
pnpm dev   # http://localhost:3000, proxies /api/* to the backend on :8000
```

Generate `ENCRYPTION_KEY` (a real Fernet key — required, not a placeholder):

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Full walkthrough, including the Celery worker/beat and the Discord Gateway connector, is
in `docs/setup.md`.

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
