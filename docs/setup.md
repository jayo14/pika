# Pika Development Setup

## Current repository state

This repository currently contains a **React/Vite front-end prototype**. Its authentication screens, dashboard, and data are browser-local demonstrations. It has no real Discord connection, production session store, database, worker queue, or API-data pipeline.

## Required production configuration

```text
PIKA_ENV=development|staging|production
DATABASE_URL=...
REDIS_URL=...
PIKA_SESSION_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_REDIRECT_URI=...
DISCORD_BOT_TOKEN=...
ENCRYPTION_KEY=...
```

Never commit actual values. The bot token, client secret, refresh tokens, database URL, and encryption key stay server-side. Do not add a Discord user-token variable: Pika must never accept it.

## Local-service layout

```text
api/              FastAPI application
worker/           Gateway, signal, notification, retention workers
web/              React web client
postgres/         relational store and full-text indexes
redis/            queue, rate-limit and short-lived state store
```

## Startup order for the real product

1. Start PostgreSQL and Redis.
2. Apply schema migrations.
3. Start the FastAPI service and validate health endpoints.
4. Start workers without Discord credentials in dry-run mode.
5. Configure OAuth redirect URLs and bot scopes in Discord Developer Portal.
6. Add a test server through an administrator-owned account, select allowed channels, and create a narrow monitor.
7. Enable a real worker only after logs, deletion, connection-revocation, and rate-limit paths have been tested.

The required production services are intentionally not started from the current static prototype. They require a selected deployment target, managed secrets, and an approved Discord Developer application.
