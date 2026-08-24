# Pika V1 API Design

The production API is versioned under `/api/v1`. Browser requests authenticate through secure HTTP-only sessions. All responses are workspace-scoped; identifiers in a route are never sufficient authorization by themselves.

| Area | Endpoint shape | Purpose |
| --- | --- | --- |
| Auth | `POST /auth/signup`, `POST /auth/signin`, `POST /auth/signout`, `POST /auth/password-reset` | Pika account lifecycle. |
| Workspaces | `GET /workspaces`, `POST /workspaces`, `GET /workspaces/{id}` | Tenant bootstrap and selection. |
| Discord | `POST /discord/oauth/start`, `GET /discord/oauth/callback`, `POST /connections/{id}/install`, `POST /connections/{id}/revoke` | Official authorization and connection lifecycle. |
| Scope | `GET/PUT /connections/{id}/channels` | Explicit allowed-channel configuration. |
| Community directory | `GET /communities`, `POST /communities`, `GET /communities/{id}` | Opt-in listings only. |
| Monitors | `GET/POST /monitors`, `GET/PATCH/DELETE /monitors/{id}` | Rule configuration and lifecycle. |
| Search | `POST /search`, `GET /searches`, `POST /searches/{id}/save` | Workspace full-text retrieval and saved searches. |
| Signals | `GET /signals`, `GET /signals/{id}`, `POST /signals/{id}/save`, `PATCH /signals/{id}` | Explainable results and human-owned status. |
| Saved | `GET /saved-items`, `PATCH /saved-items/{id}`, `POST /saved-items/{id}/tags` | Notes, statuses, and tags. |
| Notifications | `GET /notifications`, `PATCH /notifications/{id}/read`, `PUT /notification-preferences` | Selective in-app delivery. |
| Privacy | `POST /privacy/export`, `POST /privacy/delete`, `GET /audit-log` | User data controls and authorized audit visibility. |

## Error contract

Every endpoint returns a stable error code, user-safe message, request ID, and optional field errors. Discord rate limits or outages return a retryable integration state, never a misleading empty result. Model-processing failure leaves a raw authorized event available to rule processing where retention permits; it does not block the rest of the pipeline.

## API security contract

All state-changing routes require authentication, workspace authorization, server-side validation, CSRF protection for cookie sessions, and audit logging where the action changes connection scope, exports data, deletes data, or changes monitors. API responses must omit tokens, internal provider errors, and content outside the requesting workspace.
