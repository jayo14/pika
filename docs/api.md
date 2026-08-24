# Pika V1 API Design

The production API is versioned under `/api/v1`. Browser requests authenticate through secure HTTP-only sessions. All responses are workspace-scoped; identifiers in a route are never sufficient authorization by themselves.

The table below reflects the actually-implemented routes (`api/app/routers/`), not a forward-looking design. Where the original design differs from what shipped, the note says so — nothing below is aspirational.

| Area | Endpoint shape | Purpose |
| --- | --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/signin`, `POST /auth/signout`, `GET /auth/me` | Pika account lifecycle. No password-reset endpoint exists yet — the client's "forgot password" screen is explicitly labeled as not sending anything. |
| Workspaces | `GET /workspaces`, `POST /workspaces`, `GET /workspaces/{id}` | Tenant bootstrap and selection. |
| Discord | `POST /discord/oauth/start`, `GET /discord/oauth/callback`, `POST /connections/{id}/revoke` | Official authorization and connection lifecycle. There is no separate "install" step — OAuth callback both authorizes and installs the connection in one exchange. |
| Scope | `GET/PUT /connections/{id}/channels` | Explicit allowed-channel configuration; the Gateway connector (`api/app/workers/gateway.py`) only ingests messages from channels listed here with `mode: allow`. |
| Monitors | `GET/POST /monitors`, `GET/PATCH/DELETE /monitors/{id}` | Rule configuration and lifecycle. `POST /monitors` takes a `keyword` and creates one `contains`-rule `MonitorRule` alongside the monitor — V1's rule model is one keyword per monitor, not a general rule builder. |
| Search | `POST /search`, `GET /searches`, `POST /searches/{id}/save` | PostgreSQL full-text search over ingested event content, scoped to the workspace; every run is logged to search history, `POST /searches/{id}/save` flags one as saved. |
| Signals | `GET /signals`, `GET /signals/{id}`, `POST /signals/{id}/save`, `PATCH /signals/{id}` | Explainable results and human-owned status. |
| Saved | `GET /saved-items`, `PATCH /saved-items/{id}` | Notes and statuses. Tagging is not implemented — `tags`/`saved_item_tags` tables exist in the schema but no endpoint writes to them yet. |
| Notifications | `GET /notifications`, `PATCH /notifications/{id}/read`, `GET/PUT /notification-preferences` | Selective in-app delivery: a per-monitor Redis cooldown limits how often a notification is created at all, and a per-member `min_priority`/`in_app_enabled` preference filters what `GET /notifications` returns. |
| Billing | `GET /billing/subscription`, `GET /billing/usage`, `POST /billing/plan` | Plan/usage state and limit enforcement (monitors, connections) against `api/app/core/billing_plans.py`. Upgrading to a paid plan requires a configured payment provider (`STRIPE_SECRET_KEY`); without one, `POST /billing/plan` returns 503 rather than silently activating a plan nothing is charging for. |
| Admin | `GET /admin/users`, `GET /admin/workspaces`, `GET /admin/system-health` | Staff-only (`User.is_staff`, set directly in the database — no self-service grant). Returns 404, not 403, to a non-staff caller. |
| Community directory, privacy export/delete, audit-log read | — | Not implemented. `communities` and `audit_logs` tables exist in the schema; no endpoints read or write them yet. |

## Error contract

Every endpoint returns a stable error code, user-safe message, request ID, and optional field errors. Discord rate limits or outages return a retryable integration state, never a misleading empty result. Model-processing failure leaves a raw authorized event available to rule processing where retention permits; it does not block the rest of the pipeline.

## API security contract

All state-changing routes require authentication, workspace authorization, server-side validation, CSRF protection for cookie sessions, and audit logging where the action changes connection scope, exports data, deletes data, or changes monitors. API responses must omit tokens, internal provider errors, and content outside the requesting workspace.
