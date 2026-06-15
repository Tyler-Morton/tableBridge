"""Application configuration loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_env: str = "development"
    database_url: str = "sqlite+aiosqlite:///./data/tablebridge.db"
    frontend_origin: str = "http://localhost:5173"

    # Security
    jwt_secret_key: str = "dev-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    encryption_key: str = "0" * 64  # 32-byte hex; must be overridden in prod

    # Anthropic
    anthropic_api_key: str = ""

    # Mock platform webhook secrets
    doordash_webhook_secret: str = "mock_doordash_secret_abc123"
    ubereats_webhook_secret: str = "mock_ubereats_secret_def456"
    grubhub_webhook_secret: str = "mock_grubhub_secret_ghi789"

    # Demo mode
    demo_mode: bool = True
    demo_order_interval_min: int = 30
    demo_order_interval_max: int = 90

    # AI
    ai_confidence_threshold: float = 0.85
    ai_model: str = "claude-sonnet-4-20250514"

    # Rate limiting
    rate_limit_enabled: bool = True
    auth_rate_limit: str = "10/minute"
    webhook_rate_limit: str = "60/minute"
    pin_max_attempts: int = 5
    pin_lockout_minutes: int = 15


@lru_cache
def get_settings() -> Settings:
    """Return cached settings singleton."""
    return Settings()
