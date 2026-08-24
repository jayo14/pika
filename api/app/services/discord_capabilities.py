from __future__ import annotations

from app.core.config import Settings
from app.schemas import IntegrationCapability


def discord_capability(settings: Settings) -> IntegrationCapability:
    """Expose truthful configuration state without attempting an external Discord call."""

    if settings.discord_integration_ready:
        return IntegrationCapability(
            status="ready",
            message="Discord credentials are configured. Installation and scoped authorization still require a completed OAuth flow.",
            safety_boundary="Pika will only process data from administrator-authorized servers and configured channels.",
        )

    return IntegrationCapability(
        status="configuration_required",
        message="Discord is not connected. Add approved server-side credentials before enabling an administrator-authorized connection.",
        missing_configuration=settings.discord_missing_configuration,
        safety_boundary="Pika does not collect Discord passwords, user tokens, or data from unapproved communities.",
    )


def email_capability(settings: Settings) -> IntegrationCapability:
    """Expose truthful SMTP configuration state — a password-reset request never fails
    when SMTP is unconfigured, it just logs the reset link instead of emailing it
    (see app/workers/tasks.py send_password_reset_email), same dry-run posture as the
    Discord Gateway connector with no bot token."""

    if settings.email_ready:
        return IntegrationCapability(
            status="ready",
            message="SMTP is configured. Password-reset emails will be sent.",
            safety_boundary="Only transactional account emails are sent; Pika never sends unsolicited outreach.",
        )

    return IntegrationCapability(
        status="configuration_required",
        message="SMTP is not configured. Password-reset requests still succeed, but the reset link is only logged server-side, not emailed.",
        missing_configuration=settings.email_missing_configuration,
        safety_boundary="No email is sent until SMTP credentials are explicitly configured.",
    )


def workspace_capability(settings: Settings) -> IntegrationCapability:
    missing = []
    if not settings.database_url:
        missing.append("DATABASE_URL")
    if not settings.pika_session_secret:
        missing.append("PIKA_SESSION_SECRET")
    if not settings.encryption_key:
        missing.append("ENCRYPTION_KEY")

    if not missing:
        return IntegrationCapability(
            status="ready",
            message="Workspace persistence configuration is present. Database migrations and authorization tests are still required before production use.",
            safety_boundary="All persisted records must remain workspace-scoped and retention-bound.",
        )

    return IntegrationCapability(
        status="configuration_required",
        message="Workspace persistence is not configured. No real Pika workspace data is stored by this service yet.",
        missing_configuration=missing,
        safety_boundary="The front-end prototype must not be represented as a connected production workspace.",
    )
