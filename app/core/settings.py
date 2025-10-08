from __future__ import annotations

import os
from functools import lru_cache
from typing import Any

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import URL, make_url

DEFAULT_ASYNC_DATABASE_URL = "postgresql+asyncpg://postgres:password@db:5432/gptset_dev"


class Settings(BaseSettings):
    """Central application configuration loaded via environment variables."""

    model_config = SettingsConfigDict(env_prefix="", env_file_encoding="utf-8", extra="ignore")

    env: str = Field(default="development", validation_alias=AliasChoices("ENV", "APP_ENV"))
    database_url: str = Field(
        default=DEFAULT_ASYNC_DATABASE_URL,
        validation_alias=AliasChoices("DATABASE_URL", "DATABASE_URL_ASYNC"),
    )
    database_url_sync: str | None = Field(default=None, alias="DATABASE_URL_SYNC")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    mock_ai: bool = Field(default=False, alias="MOCK_AI")
    jwt_secret_key: str = Field(default="your-secret-key", alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field(default="HS256", alias="JWT_ALGORITHM")
    jwt_exp_delta_seconds: int = Field(default=3600, alias="JWT_EXP_DELTA_SECONDS")
    db_pool_pre_ping: bool = Field(default=True, alias="DB_POOL_PRE_PING")
    db_pool_recycle: int | None = Field(default=1800, alias="DB_POOL_RECYCLE")
    db_pool_timeout: float | None = Field(default=30.0, alias="DB_POOL_TIMEOUT")
    database_echo: bool = Field(default=False, alias="DATABASE_ECHO")

    @property
    def is_production(self) -> bool:
        return self.env.lower() == "production"

    @property
    def async_database_url(self) -> str:
        return self.database_url

    @property
    def sync_database_url(self) -> str:
        if self.database_url_sync:
            return self.database_url_sync

        url: URL = make_url(self.database_url)
        drivername = url.drivername

        if "+" in drivername:
            base_driver, _, dialect_driver = drivername.partition("+")
            if dialect_driver == "asyncpg":
                return str(url.set(drivername=base_driver))
            if dialect_driver == "aiosqlite":
                return str(url.set(drivername="sqlite"))

        return self.database_url


def _resolve_env_file() -> str | None:
    env_name = os.environ.get("ENV") or os.environ.get("APP_ENV") or "development"
    if env_name.lower() == "production":
        return None
    return os.environ.get("SETTINGS_ENV_FILE", ".env")


@lru_cache(1)
def get_settings() -> Settings:
    env_file = _resolve_env_file()
    kwargs: dict[str, Any] = {}
    if env_file:
        kwargs["_env_file"] = env_file
        kwargs["_env_file_encoding"] = "utf-8"
    return Settings(**kwargs)


_settings = get_settings()
JWT_SECRET_KEY = _settings.jwt_secret_key
JWT_ALGORITHM = _settings.jwt_algorithm
JWT_EXP_DELTA_SECONDS = _settings.jwt_exp_delta_seconds
