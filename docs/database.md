# Pika V1 Database Design

## Design principles

Every user-owned record is workspace-scoped. Discord raw data is minimized and given an explicit retention deadline. Derived signals retain only the evidence necessary to explain a surfaced result. IDs are UUIDs; timestamps are UTC; mutable records keep `created_at` and `updated_at`.

| Table | Purpose | Key fields | Notes |
| --- | --- | --- | --- |
| `users` | Pika identity | `id`, `email`, `display_name`, `status` | Pika credentials/session metadata only. |
| `workspaces` | Tenant boundary | `id`, `name`, `owner_user_id`, `retention_days` | All data queries scope to this table. |
| `workspace_memberships` | Authorization | `workspace_id`, `user_id`, `role` | Unique `(workspace_id, user_id)`. |
| `discord_connections` | Authorized server integration | `id`, `workspace_id`, `discord_guild_id`, `status`, `granted_at`, `revoked_at`, `consent_version` | Does not store user passwords. Tokens are encrypted and access-restricted. |
| `connection_channels` | Channel allowlist | `connection_id`, `discord_channel_id`, `mode` | Explicit allow/deny, not inferred permission. |
| `communities` | Opt-in directory profile | `id`, `connection_id`, `name`, `description`, `listing_status` | Only administrator-submitted/public profile fields. |
| `monitors` | User-configured rules | `id`, `workspace_id`, `connection_id`, `name`, `type`, `priority`, `enabled` | One connection per monitor initially. |
| `monitor_rules` | Rule conditions | `monitor_id`, `field`, `operator`, `value` | Keyword, topic, channel, event type. |
| `events` | Minimal normalized authorized event | `id`, `connection_id`, `source_event_id`, `event_type`, `occurred_at`, `expires_at`, `payload_ciphertext` | Unique `(connection_id, source_event_id)`. |
| `signals` | Explainable matched event | `id`, `workspace_id`, `event_id`, `monitor_id`, `kind`, `score`, `explanation_json`, `status` | Stores reason components and model-use label. |
| `saved_items` | Personal workspace list | `id`, `workspace_id`, `signal_id`, `saved_by`, `status`, `note` | Unique active save per signal/workspace. |
| `tags` / `saved_item_tags` | User organization | `workspace_id`, `name`; join table | Tags remain workspace-local. |
| `notifications` | Selective in-app alerts | `id`, `workspace_id`, `signal_id`, `priority`, `read_at`, `delivered_at` | Delivery is deduplicated/cooldown-aware. |
| `audit_logs` | Sensitive action record | `id`, `workspace_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `metadata` | Log connection, scope, export, deletion, and admin actions; redact content/secrets. |

## Retention and deletion

`events.expires_at` is mandatory. A worker deletes raw event payloads on expiry, connection revocation, workspace deletion, or a qualifying deletion request. Saved items may preserve a minimal user-authored note and non-content metadata only where lawful and documented; derived records must never prevent a required deletion.

## Tenant-isolation controls

The database layer applies `workspace_id` to every repository query and mutation. API authorization checks both authenticated identity and workspace membership before resource lookup. Background tasks take a `workspace_id` and `connection_id`, resolve ownership server-side, and reject mismatched combinations. Integration tests must attempt cross-workspace reads and writes for every workspace-owned resource.
