# Pika Technical Architecture

## Architectural decision

| Decision | Reason | Alternatives considered | Choice |
| --- | --- | --- | --- |
| Production backend | Pika needs long-running Gateway ingestion, reliable rate-limit handling, scheduled retention, and worker isolation; the current static site cannot provide these. | Retain static-only prototype; use the managed Node full-stack template; deploy a dedicated Python backend. | Use a dedicated Python/FastAPI service with PostgreSQL, Redis, and Celery-compatible workers for production. Keep this repository’s React interface as the product client until a migration is approved. |
| Discord data access | Discord OAuth and a server-installed bot are supported patterns; a normal user session is not a safe authorization mechanism. | User-token/session-based collection; browser automation; administrator-installed bot. | Administrator-authorized bot plus OAuth2, minimum scopes/intents, channel allowlists. |
| Signal processing | Deterministic rules are explainable and inexpensive; model outputs are uncertain. | LLM-first pipeline; rule-first with optional classifier. | Rule-first; optional AI only after a rule or user action makes it worthwhile. |
| Search | V1 needs predictable full-text retrieval and filtering. | Elastic/OpenSearch; PostgreSQL full-text search; vector-only search. | PostgreSQL full-text search first; evaluate pgvector only after measured need. |

## Proposed production topology

```text
React / TypeScript web client
          │ HTTPS
          ▼
FastAPI API ───────────────► PostgreSQL
   │       │                    │
   │       └──────────────► Redis (rate limits, queues, ephemeral state)
   │                                │
   └──────────────────────────────► Worker pool
                                     ├─ Discord Gateway connector
                                     ├─ event normalizer
                                     ├─ rule / signal engine
                                     ├─ notification dispatcher
                                     └─ retention and deletion jobs
```

The Gateway connector is a separately supervised process. It stores a resumable cursor/session state, respects connection and REST limits, emits idempotent normalized events, and does not perform model calls in the Gateway receive loop. Discord requires applications to respect rate-limit response headers rather than hard-code limits.[1]

## Core data flow

1. An administrator authorizes Pika and installs the bot with minimum permissions.
2. The connection record stores granted scope, selected channels, consent record, and lifecycle status.
3. The Gateway worker receives only allowed events, validates tenant/channel scope, and writes a minimal immutable normalized event.
4. A worker evaluates monitors against the event. A match creates an explainable signal and a user-visible notification candidate.
5. The UI reads workspace-scoped signals through the API; all routes enforce `workspace_id` membership.
6. A retention worker deletes expired raw content and associated derived fields according to connection/workspace policy.

## Signal engine

```text
Authorized event
  → normalizer
  → channel/workspace scope check
  → deterministic rule match
  → optional classifier/summarizer
  → score + reasons
  → signal
  → notification candidate
```

Every signal exposes: monitor name, matching evidence, event timestamp, channel/community context, deterministic criteria, optional model-use label, and a confidence statement. Scores are configurable heuristics—not scientific claims about a person or an opportunity.

## Security boundaries

The worker never exposes Discord credentials to the browser. API data and application secrets are encrypted at rest, secrets are held in environment-managed storage, logs redact tokens and message bodies by default, and every endpoint verifies workspace membership. Discord’s terms require commercially reasonable protection of API data, including encryption at rest, and deletion/update mechanisms.[2]

## Sources

[1] [Discord Rate Limits](https://docs.discord.com/developers/topics/rate-limits)

[2] [Discord Developer Terms of Service](https://support-dev.discord.com/hc/en-us/articles/8562894815383-Discord-Developer-Terms-of-Service)
