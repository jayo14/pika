from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import Settings

logger = logging.getLogger("pika.email")


def send_email(settings: Settings, *, to: str, subject: str, body: str) -> None:
    """Sends one transactional email over SMTP. Raises on failure — the caller (a Celery
    task) is responsible for retry/logging, this function does not swallow errors."""

    if not settings.email_ready:
        raise RuntimeError("SMTP is not configured (SMTP_HOST/SMTP_FROM_EMAIL missing).")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = to
    message.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
