# Pika V1 Delivery Roadmap

| Phase | Outcome | Exit criterion | Status |
| --- | --- | --- | --- |
| 0. Research and policy review | Confirm use cases, permission requirements, retention policy, and App Review triggers | Feasibility matrix approved; prohibited patterns excluded. | Done |
| 1. Foundation | FastAPI service, PostgreSQL schema, Redis, session auth, workspaces, observability baseline | Tenant-isolation and auth tests pass. | Done |
| 2. Authorized connection | Discord OAuth, installation flow, encrypted connection credentials, scope chooser, revoke/delete flow | Test server can connect and disconnect without retaining unauthorized data. | Done |
| 3. Monitoring and events | Gateway connector, allowlisted channels, idempotent normalized events, rule monitors | A scoped message/event produces one stored authorized event. | Partial — ingestion, idempotency, channel allowlist, and monitor CRUD are implemented and tested; the live Discord Gateway connector process is not built. |
| 4. Signals and workspace | Deterministic matching, explanations, signal inbox, save/note/status flows | User can explain and save a result end to end. | Done |
| 5. Search and discovery | Full-text search over retained data, saved searches, opt-in directory | Search and directory results respect all workspace/scope boundaries. | Not started |
| 6. Notifications and deletion | Selective in-app alerts, preferences, retention worker, connection/workspace deletion | Alert cooldown and data-deletion integration tests pass. | Partial — the hourly retention/purge task and per-signal notification creation exist; user-facing notification preferences and alert cooldown are not built. |
| 7. Limited beta | App Review readiness, support/reporting flow, security review, quality instrumentation | First real administrator completes the core workflow on a test community. | Not started |

The front-end (`client/`) can continue to validate interface concepts, but it is not yet wired to the `api/` backend described above.
