# Pika Monorepo Guide

```text
client/       React + TypeScript user interface, wired to the FastAPI backend over /api
api/          Python FastAPI service, database models, workers, Celery task queue
docs/         product, security, policy, data model, and delivery records
shared/       legacy shared TypeScript constants retained during an earlier frontend migration
```

## Local commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the React client with the root Vite configuration (port 3000). Proxies `/api/*` to the FastAPI backend on `http://127.0.0.1:8000` — see `docs/setup.md` for starting the backend. |
| `pnpm build` | Build the client into `dist/public`. |
| `pnpm check` | Type-check the client and syntax-check the FastAPI source. |
| `pnpm test:api` | Run the FastAPI test suite (against real local Postgres/Redis — see `docs/setup.md`). |
| `cd api && uvicorn app.main:app --reload` | Run the FastAPI backend locally. |

The FastAPI backend implements real session-cookie auth, workspace-scoped persistence, the Discord OAuth connection flow, monitors, the rule-based signal engine, saved items, full-text search, notification preferences, billing plan/subscription state, and an admin API — see `docs/setup.md` for current status and what remains (the live Discord Gateway ingestion worker's actual connection to Discord, in particular, degrades gracefully to a no-op when `DISCORD_BOT_TOKEN` is unset).

## Required runtime settings

Supply these as managed server-side environment variables during deployment: `DATABASE_URL`, `REDIS_URL`, `PIKA_SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_BOT_TOKEN`, and `ENCRYPTION_KEY`. Never place their values in version-controlled files or the browser bundle. The client needs no backend secret of its own — it talks to the API same-origin through the Vite dev proxy locally, or `VITE_API_BASE_URL` plus CORS-permitted credentials in a split deployment.
