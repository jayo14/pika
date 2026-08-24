# Pika Security and Privacy Baseline

## Controls required before real Discord data flows

| Domain | Required control | Verification |
| --- | --- | --- |
| Authentication | Secure session cookies, password hashing if local credentials remain, session rotation, reset-token expiry | Auth and reset tests; cookie inspection. |
| Discord authorization | OAuth2 authorization code flow, state/PKCE where supported, encrypted refresh tokens, revocation flow | Callback-state, revocation, and no-token-in-client tests. |
| Authorization | Workspace membership enforcement on every API and job | Cross-tenant read/write tests. |
| Data minimization | Explicit allowed-channel list, no collection outside declared feature scope, configurable retention | Scope tests and scheduled deletion tests. |
| Secrets | Server-only environment variables, encrypted storage, no token/log leakage | Static secret scan and redacted-log checks. |
| Input/output | Schema validation, parameterized queries, output encoding, safe error responses | Invalid-input and XSS regression tests. |
| Operations | Rate-limit coordinator, audit logs, alerting for repeated integration failures, incident runbook | Chaos/retry and audit-log tests. |

Pika cannot accept Discord passwords, normal user tokens, or browser-session data. The browser receives neither bot tokens nor OAuth refresh tokens. Discord explicitly prohibits credential collection and scraping and requires API data to be used only for the stated function.[1]

## Data lifecycle

1. The connection consent record identifies the authorized server, allowed channels, and purpose.
2. Authorized data is encrypted at rest and retained only to power configured monitors, search, signals, and saved items.
3. A deletion request, revoked connection, expired retention deadline, or Discord request initiates a durable deletion job.
4. The job records a redacted audit event, removes raw payload and derived records as required, and reports failure for manual remediation.

## Prohibited product behavior

No bulk user export, individual profiling, normal-user session emulation, CAPTCHA/rate-limit avoidance, automated Discord outreach, advertising based on API data, or training models on Discord message content without express permission. The Developer Policy bars scraping, API-data profiling, and message-content model training without express permission.[1]

## Sources

[1] [Discord Developer Policy](https://support-dev.discord.com/hc/en-us/articles/8563934450327-Discord-Developer-Policy)
