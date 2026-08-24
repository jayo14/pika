from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Sensitive values are server-only environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    pika_env: Literal["development", "staging", "production"] = "development"
    pika_api_prefix: str = "/api/v1"
    pika_cors_origins: str = "http://localhost:3000"
    database_url: str | None = None
    redis_url: str | None = None
    pika_session_secret: str | None = None
    discord_client_id: str | None = None
    discord_client_secret: str | None = None
    discord_redirect_uri: str | None = None
    discord_bot_token: str | None = None
    encryption_key: str | None = None
    stripe_secret_key: str | None = None
    stripe_webhook_secret: str | None = None
    product_name: str = "Pika API"
    version: str = "0.1.0"

    @property
    def billing_provider_ready(self) -> bool:
        return bool(self.stripe_secret_key)

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.pika_cors_origins.split(",") if origin.strip()]

    @property
    def discord_missing_configuration(self) -> list[str]:
        required = {
            "DISCORD_CLIENT_ID": self.discord_client_id,
            "DISCORD_CLIENT_SECRET": self.discord_client_secret,
            "DISCORD_REDIRECT_URI": self.discord_redirect_uri,
            "DISCORD_BOT_TOKEN": self.discord_bot_token,
        }
        return [name for name, value in required.items() if not value]

    @property
    def discord_integration_ready(self) -> bool:
        return not self.discord_missing_configuration


@lru_cache
def get_settings() -> Settings:
    return Settings()
