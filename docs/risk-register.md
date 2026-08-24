# Pika V1 Risk Register

| Risk | Likelihood | Impact | Mitigation | Owner / gate |
| --- | --- | --- | --- | --- |
| Message-content access is unavailable or not approved at scale | Medium | High | Build interaction/context-menu alternatives; do not promise broad content search until intent/App Review status is confirmed. | Product + Discord integration |
| Product drift toward user-session collection or scraping | Medium | Critical | Explicitly prohibit user tokens, browser automation, and scraping; architectural review before each Discord feature. | Security |
| Personal-data overcollection | Medium | High | Channel allowlists, minimal event schema, retention expiry, deletion APIs, audit logs. | Privacy engineering |
| Cross-workspace data exposure | Low | Critical | Workspace-scoped repository layer, authorization tests, row-level policy where appropriate, audit logging. | Backend |
| Rate-limit or Gateway instability | Medium | Medium | Header-driven limiter, retries with backoff, resumable sessions, idempotent queue processing, degraded UI states. | Platform |
| AI output overstates relevance | Medium | Medium | Rule-first signals, model-use labels, explanations, human action required, quality evaluation. | Product + ML |
| Unwanted notification noise | High | Medium | Priority policy, cooldowns, digest defaults, per-monitor preferences. | Product |
| Architecture mismatch with current static template | Certain | High | Keep prototype separate; approve a FastAPI deployment target before implementing real ingestion. | Product owner |
| Misleading competitive feature copying | Medium | High | Treat WiseCord’s user-session/member-export approach as a non-goal; use official Discord paths only. | Product + Security |
