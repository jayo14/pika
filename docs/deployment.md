# Pika Deployment Guidance

## Deployment decision

Pika’s real product requires a persistent API, encrypted database, Redis-backed job queue, and a continuously supervised Gateway worker. The current front-end hosting can continue serving the prototype, but it cannot itself supply compliant Discord ingestion or background processing.

| Component | Runtime requirement | Minimum production responsibility |
| --- | --- | --- |
| Web client | Static hosting or web server | TLS, CSP, no secrets in client bundle. |
| FastAPI API | Persistent HTTP service | Secure sessions, OAuth callback, workspace authorization, health checks. |
| Gateway/worker service | Long-running supervised process | Reconnect/resume, idempotency, rate-limit coordination, bounded retries. |
| PostgreSQL | Managed encrypted relational store | Backups, migration process, tenant access controls. |
| Redis | Managed volatile queue/state | Access controls, eviction plan, observability. |
| Secrets | Managed secret service | Rotation, least privilege, auditability. |

## Hosting constraints

The managed web-development runtime can host a web application and, in Reserved mode, a persistent single process. However, the attached specification requires a Python/FastAPI primary backend and separately supervised workers. The deployment must therefore be explicitly approved as either:

1. a dedicated Python service plus managed PostgreSQL/Redis alongside the existing web client; or
2. a custom-runtime deployment whose operational limits are validated before production.

Autoscaling request runtimes cannot be relied on for an in-container background worker because background work may be throttled when no request is active. A real Gateway connector must be treated as a first-class service, with health monitoring and restart policy.[1]

## Release gates

Before a production Discord connection is enabled, complete: an external security review; OAuth redirect and consent copy review; privileged-intent/App Review assessment; privacy/retention and deletion-flow review; rate-limit and reconnect tests; cross-tenant authorization tests; and a dry run with an administrator-owned test server.

## Source

[1] [Custom Runtime Deployment Guidance](../README.md) — this repository’s platform guidance is recorded in the implementation environment and must be revalidated against the active host before deployment.
