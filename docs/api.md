# Pika API Reference

Every route below is implemented in `api/app/routers/` — this document is generated from
reading that code, not a forward-looking design (compare `git log` if anything drifts).
Interactive, auto-generated docs are also available on a running instance: `GET /docs`
(Swagger UI), `GET /redoc` (ReDoc), `GET /scalar` (Scalar — the richest of the three),
and the raw schema at `GET /openapi.json`. All four are generated from the same FastAPI
route/Pydantic definitions this document was written by reading — there is no separate
schema to keep in sync (this project is FastAPI, not Django/DRF, so drf-spectacular
doesn't apply here; `scalar-fastapi` is FastAPI's equivalent).

**Base URL**: `/api/v1` (`PIKA_API_PREFIX`). All paths below are relative to it.

**Auth**: an HttpOnly, Redis-backed session cookie (`pika_session`), set by
`/auth/signup` and `/auth/signin`. There is no bearer token — the browser sends the
cookie automatically; a non-browser client must capture and resend it
(`credentials: "include"` in `fetch`). No route accepts a Discord password or a raw
Discord user token, ever.

**Tenant isolation**: every workspace-scoped route requires proving membership before
the resource lookup happens. A workspace/resource that exists but the caller isn't a
member of returns **404**, not 403 — a non-member can't distinguish "doesn't exist" from
"exists, not yours." A few sensitive actions additionally require the `owner` role within
that workspace (not just any member) and return **403** when a member's role is too low —
see "Role-based access control" below.

**Error shape**: `{"detail": "..."}` with a standard HTTP status code (FastAPI/Pydantic
default). Validation errors on request bodies return 422 with Pydantic's per-field error
list instead of the plain `detail` string.

---

## Role-based access control

A `WorkspaceMembership.role` is `owner` (the workspace creator) or `member`. Routes
marked **owner-only** below call `ensure_workspace_role(..., min_role="owner")`
(`api/app/core/deps.py`) and return 403 for a member; everything else only requires
membership. Owner-only actions: starting a Discord OAuth connection, revoking a
connection, editing a connection's channel allowlist, and changing the billing plan —
each affects the whole workspace's data scope or spend, not just the caller's own view.

---

## System — no auth

| Method | Path | Response | Notes |
| --- | --- | --- | --- |
| GET | `/healthz` | `{status, service, version}` | Liveness probe; used as the Docker `HEALTHCHECK` and Render `healthCheckPath`. |
| GET | `/capabilities` | `{api, discord: IntegrationCapability, workspace: IntegrationCapability}` | Truthful configuration-readiness check — reports whether Discord/DB/Redis/session-secret env vars are actually set, without attempting a live Discord call. `IntegrationCapability = {status: "ready"|"configuration_required", message, missing_configuration[], safety_boundary}`. |

## Auth (`/auth`) — no auth required except `/me`

| Method | Path | Auth | Body | Response |
| --- | --- | --- | --- | --- |
| POST | `/auth/signup` | none | `SignupRequest` | `201` `SessionResponse` |
| POST | `/auth/signin` | none | `SigninRequest` | `200` `SessionResponse` |
| POST | `/auth/signout` | session cookie | — | `204` |
| GET | `/auth/me` | session cookie | — | `200` `SessionResponse` |

- `SignupRequest = {email, password (10–128 chars), display_name?, workspace_name?}`.
  Creates the user (argon2-hashed password), a workspace (default name "My Workspace"),
  and a `WorkspaceMembership` with `role="owner"`. Returns `409` if the email is taken.
- `SigninRequest = {email, password}`. Returns `401` on any mismatch or an inactive
  account — the same generic message either way, so a failed attempt can't be used to
  enumerate registered emails.
- `SessionResponse = {user: UserOut, workspaces: WorkspaceMembershipOut[]}`.
  `UserOut = {id, email, display_name, status, is_staff, created_at}`.
  `WorkspaceMembershipOut = {id, name, owner_user_id, retention_days, created_at, role}`.
- Signing in/up sets the session cookie: `HttpOnly`, 14-day sliding TTL, `SameSite=Lax`
  in development or `SameSite=None; Secure` in production (`PIKA_ENV=production` — see
  `docs/deployment.md` for why the split-domain Render topology needs this).
- `is_staff` (gates the admin API) has no self-service path — it's set directly in the
  database by an operator.

## Workspaces (`/workspaces`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/workspaces` | session | — | `200` `WorkspaceOut[]` — every workspace the caller is a member of |
| POST | `/workspaces` | session | `WorkspaceCreate` | `201` `WorkspaceOut` |
| GET | `/workspaces/{workspace_id}` | session + member | — | `200` `WorkspaceOut` (404 if not a member) |

- `WorkspaceCreate = {name (1–120 chars), retention_days? (1–365, default 30)}`. Creates
  the workspace and grants the caller `role="owner"` on it.
- `WorkspaceOut = {id, name, owner_user_id, retention_days, created_at}` — no `role` field
  (that's `WorkspaceMembershipOut`, used only in `/auth/*` responses where "which
  workspaces am I in, and as what" is the actual question).

## Discord connections (`/discord`, `/connections`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| POST | `/discord/oauth/start` | session + **owner** | `{workspace_id}` | `200` `{authorize_url}` |
| GET | `/discord/oauth/callback` | none (state-validated) | `?code&state&error` | `302` redirect |
| GET | `/connections` | session + member | `?workspace_id` | `200` `DiscordConnectionOut[]` |
| POST | `/connections/{connection_id}/revoke` | session + **owner** | — | `200` `DiscordConnectionOut` |
| GET | `/connections/{connection_id}/channels` | session + member | — | `200` `ConnectionChannelOut[]` |
| PUT | `/connections/{connection_id}/channels` | session + **owner** | `ConnectionChannelIn[]` | `200` `ConnectionChannelOut[]` (full replace) |

- `POST /discord/oauth/start`: 503 if `DISCORD_CLIENT_ID`/`SECRET`/`REDIRECT_URI`/
  `BOT_TOKEN` aren't all configured; 402 if the workspace's plan connection limit
  (`api/app/core/billing_plans.py`) is already used up. On success, stores a one-time
  CSRF state token in Redis (10-minute TTL) and returns the real
  `https://discord.com/oauth2/authorize` URL — the browser must navigate there directly
  (not fetch it), since Discord itself renders the consent screen.
- `GET /discord/oauth/callback`: Discord redirects the browser here after consent. Not
  cookie-authenticated — the state token (consumed exactly once from Redis) carries which
  user/workspace initiated the flow. Always redirects to
  `{PIKA_CORS_ORIGINS[0]}/settings?tab=integrations&discord_status=connected|error|expired`;
  never returns JSON. On success it upserts the `DiscordConnection`, encrypting the
  access/refresh token (Fernet, `ENCRYPTION_KEY`) before storing them.
- `ConnectionChannelIn = {discord_channel_id, mode: "allow"|"deny"}`. The Gateway
  connector (`api/app/workers/gateway.py`) only ingests messages from a channel with an
  explicit `"allow"` row here — an unlisted channel, or one marked `"deny"`, is silently
  skipped. `PUT` replaces the entire allowlist for that connection, not a partial merge.
- `POST .../revoke`: sets `status="revoked"` and **clears both encrypted token fields** —
  a revoked connection retains no usable secret material, not just a status flag.
- `DiscordConnectionOut = {id, workspace_id, discord_guild_id, discord_guild_name, status, granted_at, revoked_at, created_at}` (never includes the encrypted tokens).

## Monitors (`/monitors`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/monitors` | session + member | `?workspace_id` | `200` `MonitorOut[]` |
| POST | `/monitors` | session + member | `MonitorCreate` | `201` `MonitorOut` |
| GET | `/monitors/{monitor_id}` | session + member | — | `200` `MonitorOut` |
| PATCH | `/monitors/{monitor_id}` | session + member | `MonitorUpdate` | `200` `MonitorOut` |
| DELETE | `/monitors/{monitor_id}` | session + member | — | `204` |

- `MonitorCreate = {workspace_id, connection_id, name, monitor_type, priority? (low|normal|high|critical, default normal), enabled? (default true), keyword}`.
  `keyword` (1–200 chars) is not decorative — it creates one `MonitorRule(field="content", operator="contains", value=keyword)` alongside the monitor. **V1's rule model is exactly one contains-keyword per monitor**, not a general rule builder; there's no separate endpoint to add more rules to an existing monitor. Returns 404 if `connection_id` doesn't belong to `workspace_id`; 402 if the plan's monitor limit is used up.
- `MonitorUpdate = {name?, priority?, enabled?}` — all optional, only supplied fields change (`exclude_unset`).
- `MonitorOut` never includes the keyword/rules — there's currently no read endpoint for a monitor's `MonitorRule` rows once created.
- Unlike Discord connection actions, any workspace member (not just the owner) can create, edit, or delete monitors — day-to-day monitor management is treated as collaborative, not sensitive.

## Signals (`/signals`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/signals` | session + member | `?workspace_id&status?` | `200` `SignalOut[]` |
| GET | `/signals/{signal_id}` | session + member | — | `200` `SignalOut` |
| PATCH | `/signals/{signal_id}` | session + member | `SignalStatusUpdate` | `200` `SignalOut` |
| POST | `/signals/{signal_id}/save` | session + member | — | `201` `SavedItemOut` |

- Signals are created only by the background pipeline (`app/workers/tasks.py`
  `process_event`), never directly via the API — there is no `POST /signals`.
- `?status` filters to `new` / `saved` / `archived`, matching `SignalStatusUpdate`'s
  `Literal`.
- `SignalOut = {id, workspace_id, event_id, monitor_id, kind, score, explanation, status, created_at}`. `explanation` is a JSON object shaped `{reasons: [{field, operator, value, description}], rule_count, matched_count}` — the whole point of the signal engine (`app/services/signal_engine.py`) is that this is never a bare confidence number without the reasons that produced it.
- `POST .../save`: idempotent per `(workspace_id, signal_id)` — calling it again on an already-saved signal returns the existing `SavedItem` rather than erroring or duplicating. Also sets the signal's `status` to `"saved"`.

## Saved items (`/saved-items`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/saved-items` | session + member | `?workspace_id` | `200` `SavedItemOut[]` |
| PATCH | `/saved-items/{saved_item_id}` | session + member | `SavedItemUpdate` | `200` `SavedItemOut` |

- Creation only happens via `POST /signals/{id}/save` above — there's no standalone
  `POST /saved-items`.
- `SavedItemUpdate = {status?, note?}`, both optional/independent. `status` is a free
  string here (not a `Literal`) — the client's `Saved` page offers
  `open/researching/watching/contacted/qualified/won/ignored/archived` as suggested
  values, but the API doesn't enforce that set.
- `SavedItemOut = {id, workspace_id, signal_id, saved_by_user_id, status, note, created_at}`.

## Notifications (`/notifications`, `/notification-preferences`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/notification-preferences` | session + member | `?workspace_id` | `200` `NotificationPreferenceOut` |
| PUT | `/notification-preferences` | session + member | `?workspace_id`, body `NotificationPreferenceUpdate` | `200` `NotificationPreferenceOut` |
| GET | `/notifications` | session + member | `?workspace_id&unread_only?` | `200` `NotificationOut[]` |
| PATCH | `/notifications/{notification_id}/read` | session + member | — | `200` `NotificationOut` |

- Preferences are per-`(workspace_id, user_id)`, not per-workspace — each member has
  their own. `GET` returns sensible defaults (`min_priority="low"`, `in_app_enabled=true`)
  without writing a row if the member has never set one.
- Notifications themselves are created by the background pipeline, gated two ways before
  a row ever exists: a **per-monitor Redis cooldown** (15 minutes — a monitor matching
  repeatedly in a burst doesn't spawn a notification for every match) at creation time,
  and then `GET /notifications` additionally filters out anything below the requesting
  member's `min_priority` or all of it if they've set `in_app_enabled=false`. There is no
  `POST /notifications`.
- `NotificationOut = {id, workspace_id, signal_id, priority, delivered_at, read_at, created_at}`.

## Search (`/search`, `/searches`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| POST | `/search` | session + member | `SearchRequest` | `200` `SearchResponse` |
| GET | `/searches` | session + member | `?workspace_id&saved_only?` | `200` `SavedSearchOut[]` |
| POST | `/searches/{search_id}/save` | session + member | — | `200` `SavedSearchOut` |

- `SearchRequest = {workspace_id, query (1–500 chars), save? (default false)}`. Runs
  PostgreSQL full-text search (`plainto_tsquery` — user input is never interpreted as
  tsquery operator syntax) over ingested event content, scoped to the workspace via a
  join through `discord_connections`, ranked by `ts_rank`, capped at 25 results.
- Every call to `POST /search` — regardless of `save` — logs a `SearchQuery` history row;
  `save: true` marks it saved immediately, or `POST /searches/{id}/save` marks an
  already-logged search saved later. `GET /searches?saved_only=true` filters to just
  those.
- `SearchResultItem = {event_id, connection_id, event_type, occurred_at, snippet, rank}`.
  `snippet` is the matched event's content decrypted and truncated to ~240 chars for
  display — the only place raw event content is decrypted and returned over the API.
- `SearchResponse = {id, query, results}` — `id` is the `SearchQuery` history row's ID,
  what you'd pass to `POST /searches/{id}/save`.

## Billing (`/billing`)

| Method | Path | Auth | Body / Query | Response |
| --- | --- | --- | --- | --- |
| GET | `/billing/subscription` | session + member | `?workspace_id` | `200` `SubscriptionOut` |
| GET | `/billing/usage` | session + member | `?workspace_id` | `200` `UsageOut` |
| POST | `/billing/plan` | session + **owner** | `?workspace_id`, body `PlanChangeRequest` | `200` `SubscriptionOut` |

- No `Subscription` row means the workspace is implicitly on the `free` plan —
  `GET /billing/subscription` synthesizes `{plan: "free", status: "active", current_period_end: null}` in that case rather than 404ing.
- `PlanChangeRequest = {plan: "free"|"pro"|"business"}`. Switching to `"free"` always
  succeeds. Switching to a paid plan returns **503** if no payment provider is configured
  (`STRIPE_SECRET_KEY` unset) — the plan is never silently activated with nothing actually
  charging for it. There is no Stripe checkout/webhook integration yet; a configured
  `STRIPE_SECRET_KEY` only unlocks this endpoint, it doesn't wire up real billing.
- `UsageOut = {workspace_id, plan, limits: PlanLimits, monitors_used, connections_used, saved_searches_used}`. `PlanLimits = {plan, monitors, connections, saved_searches, retention_days, price_usd_per_month}` — `null` on a limit field means unlimited. Limits are defined once in `api/app/core/billing_plans.py`, not scattered through route logic, and are enforced server-side (see `POST /monitors` and `POST /discord/oauth/start` above returning 402), not just displayed.

## Admin (`/admin`) — staff only

Every route here requires `require_admin` (`current_user.is_staff`); a non-staff caller
gets **404** (not 403 — a normal user can't tell the admin API exists at all).

| Method | Path | Query | Response |
| --- | --- | --- | --- |
| GET | `/admin/users` | `?limit(≤200)&offset&q?` | `200` `AdminUserListOut = {items: AdminUserOut[], total}` |
| GET | `/admin/users/{user_id}` | — | `200` `AdminUserDetail` |
| GET | `/admin/workspaces` | `?limit(≤200)&offset&q?` | `200` `AdminWorkspaceListOut = {items: AdminWorkspaceOut[], total}` |
| GET | `/admin/workspaces/{workspace_id}` | — | `200` `AdminWorkspaceDetail` |
| GET | `/admin/system-health` | — | `200` `AdminSystemHealth` |

- `q` on `/admin/users` matches email (`ILIKE %q%`); on `/admin/workspaces` matches
  workspace name.
- `AdminUserDetail = AdminUserOut & {workspaces: [{workspace_id, workspace_name, role}]}` — every workspace that user belongs to and their role in each.
- `AdminWorkspaceDetail = AdminWorkspaceOut & {members: [{user_id, email, role}], connections: [{id, discord_guild_id, discord_guild_name, status}], monitors: [{id, name, monitor_type, enabled}]}`.
- `AdminSystemHealth = {database: "ok"|"error", redis: "ok"|"error", celery_workers_online, total_users, total_workspaces, total_active_connections, events_pending_expiry_next_24h}`. `celery_workers_online` is a live `celery_app.control.inspect().ping()` (1s timeout) — 0 during local dev unless a worker process is actually running, not a fixture.
- There is no admin write path (no suspend-user, no delete-workspace, no impersonate) —
  everything under `/admin` is currently read-only observability.

## Not implemented

Referenced in the schema or in earlier design docs but with no working endpoint:
tagging saved items (`tags`/`saved_item_tags` tables exist, nothing writes to them), the
opt-in community directory (`communities` table exists, unused), audit logging
(`audit_logs` table exists, no code path writes to it), data export/deletion requests,
and password reset (the client's "forgot password" screen is explicitly labeled as not
sending anything). See `docs/v1-roadmap.md` for status by phase.
