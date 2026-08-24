# Pika Development Setup

## Current repository state

The `client/` directory holds the React/Vite front-end. The `api/` directory holds a
working FastAPI backend: async PostgreSQL persistence (SQLAlchemy + Alembic), a Redis-backed
session store, encrypted-at-rest Discord token and event storage, a Celery task queue, and
a deterministic rule-based signal engine. Session-cookie auth, workspace CRUD, the Discord
OAuth connection flow, monitors, signals, and saved items are implemented and covered by an
automated test suite (`api/tests/`). The Discord Gateway ingestion worker itself — the
process that would receive live authorized events from Discord and call
`app.services.ingestion.ingest_event` — is not yet built; everything downstream of ingestion
(rule matching, scoring, explanations, notifications, retention deletion) is implemented and
tested.

## Required configuration

```text
PIKA_ENV=development|staging|production
PIKA_API_PREFIX=/api/v1
PIKA_CORS_ORIGINS=comma,separated,origins
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db
REDIS_URL=redis://host:port/db
PIKA_SESSION_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=...
DISCORD_BOT_TOKEN=...
ENCRYPTION_KEY=...          # Fernet key: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Copy `api/.env.example` to `api/.env` and fill in real values for local development. Never
commit `api/.env`. The bot token, client secret, refresh tokens, database URL, and
encryption key stay server-side. Do not add a Discord user-token variable: Pika must never
accept it.

## Local-service layout

```text
api/                  FastAPI application
  app/core/           settings, DB session, Redis client, security, sessions, deps
  app/db/             SQLAlchemy models
  app/routers/         HTTP endpoints
  app/services/        Discord OAuth, event ingestion, signal engine
  app/workers/         Celery app and background tasks
  alembic/             schema migrations
  tests/                pytest suite (runs against real Postgres/Redis, not mocks)
client/                React web client
```

There is no separate top-level `worker/` process yet; `app/workers/` runs inside the same
package as the API and is started as its own Celery worker/beat process (see below), so
long-running or scheduled work never executes inside an HTTP request.

## Local development

1. Start PostgreSQL and Redis. For local development without installing either natively:
   ```bash
   docker run -d --name pika-postgres -e POSTGRES_USER=pika \
     -e POSTGRES_PASSWORD=pika_dev_local -e POSTGRES_DB=pika \
     -p 5433:5432 postgres:16-alpine
   ```
   and point `DATABASE_URL` in `api/.env` at
   `postgresql+asyncpg://pika:pika_dev_local@127.0.0.1:5433/pika`. Use any local or
   containerized Redis for `REDIS_URL`.
2. Install dependencies and apply migrations:
   ```bash
   cd api
   uv sync --extra dev
   uv run alembic upgrade head
   ```
3. Start the API:
   ```bash
   uv run uvicorn app.main:app --reload
   ```
   Validate `GET /api/v1/healthz` and `GET /api/v1/capabilities`.
4. Start a Celery worker and beat scheduler for background processing (event
   classification, retention cleanup):
   ```bash
   uv run celery -A app.workers.celery_app worker --loglevel=info
   uv run celery -A app.workers.celery_app beat --loglevel=info
   ```
5. Configure OAuth redirect URLs, bot scopes, and the privileged **Message Content**
   intent in the Discord Developer Portal, matching `DISCORD_REDIRECT_URI`. Then start the
   Gateway connector — the process holding the live websocket connection for the
   administrator-installed bot:
   ```bash
   uv run python -m app.workers.gateway
   ```
   With `DISCORD_BOT_TOKEN` unset it logs a dry-run notice and exits cleanly rather than
   connecting — safe to leave out of local development until a real bot is configured.
6. Run the test suite: `uv run pytest`. `api/tests/conftest.py` automatically points the
   suite at a separate `pika_test` database (same Postgres server, different database
   name) and Redis db 15, truncating/flushing only those — it never touches the dev
   database or Redis db the app itself uses, however `DATABASE_URL`/`REDIS_URL` are set.
   Create and migrate that database once before running tests for the first time:
   ```bash
   PGPASSWORD=pika_dev_local psql -h 127.0.0.1 -p 5433 -U pika -d pika -c "CREATE DATABASE pika_test OWNER pika;"
   DATABASE_URL="postgresql+asyncpg://pika:pika_dev_local@127.0.0.1:5433/pika_test" uv run alembic upgrade head
   ```
   (adjust host/port/user/password to match your own Postgres if you didn't use the
   container command in step 1).
