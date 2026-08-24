# Pika V1 Delivery Roadmap

| Phase | Outcome | Exit criterion | Status |
| --- | --- | --- | --- |
| 0. Research and policy review | Confirm use cases, permission requirements, retention policy, and App Review triggers | Feasibility matrix approved; prohibited patterns excluded. | Done |
| 1. Foundation | FastAPI service, PostgreSQL schema, Redis, session auth, workspaces, observability baseline | Tenant-isolation and auth tests pass. | Done |
| 2. Authorized connection | Discord OAuth, installation flow, encrypted connection credentials, scope chooser, revoke/delete flow | Test server can connect and disconnect without retaining unauthorized data. | Done |
| 3. Monitoring and events | Gateway connector, allowlisted channels, idempotent normalized events, rule monitors | A scoped message/event produces one stored authorized event. | Done — `api/app/workers/gateway.py` is a real discord.py client wired to the channel-allowlist + ingestion pipeline, unit-tested end to end (`tests/test_gateway_ingestion.py`). Not yet verified against a live Discord bot token (none configured in this environment); it dry-runs cleanly with `DISCORD_BOT_TOKEN` unset. |
| 4. Signals and workspace | Deterministic matching, explanations, signal inbox, save/note/status flows | User can explain and save a result end to end. | Done |
| 5. Search and discovery | Full-text search over retained data, saved searches, opt-in directory | Search and directory results respect all workspace/scope boundaries. | Partial — PostgreSQL full-text search and saved-search history are implemented and workspace-scoped. The opt-in community directory is not built. |
| 6. Notifications and deletion | Selective in-app alerts, preferences, retention worker, connection/workspace deletion | Alert cooldown and data-deletion integration tests pass. | Partial — per-monitor Redis cooldown, per-member notification preferences, and the hourly retention/purge task are implemented. Workspace/connection *deletion* (as opposed to revocation) and audit logging of these actions are not built — see docs/database.md's `audit_logs` note. |
| 7. Limited beta | App Review readiness, support/reporting flow, security review, quality instrumentation | First real administrator completes the core workflow on a test community. | Not started |

Two things beyond the original V1 scope are also implemented: a billing/subscription layer with plan-limit enforcement (`api/app/routers/billing.py`, `api/app/core/billing_plans.py`) and a staff-only admin API (`api/app/routers/admin.py`). Both are real, tested, and enforced server-side, not UI-only.

The front-end (`client/`) is now wired to the `api/` backend — real session-cookie auth, and Dashboard/Monitors/Saved/Settings/Admin pages backed by live API calls (see `docs/setup.md` for how to run both together). Marketing/static pages (`Home`, pricing, blog, etc.) are unchanged.
