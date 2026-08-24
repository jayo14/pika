# Pika Monorepo Guide

```text
frontend/     React + TypeScript user interface
api/          Python FastAPI service, database models, API contracts, workers-to-be
docs/         product, security, policy, data model, and delivery records
shared/       legacy shared TypeScript constants retained during frontend migration
```

## Local commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run the React frontend with the root Vite configuration. |
| `pnpm build` | Build the frontend into `dist/public`. |
| `pnpm check` | Type-check frontend and syntax-check FastAPI source. |
| `pnpm test:api` | Run the FastAPI contract tests. |
| `cd api && uvicorn app.main:app --reload` | Run the credential-free FastAPI foundation locally. |

The FastAPI package deliberately exposes only real capability and health checks until Discord OAuth credentials, PostgreSQL, Redis, migration infrastructure, and an administrator-owned test server are configured. It does not invent a Discord connection, sample workspace, or event stream.

## Required runtime settings

Supply these as managed server-side environment variables during deployment: `DATABASE_URL`, `REDIS_URL`, `PIKA_SESSION_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `DISCORD_BOT_TOKEN`, and `ENCRYPTION_KEY`. Never place their values in version-controlled files or the browser bundle.
