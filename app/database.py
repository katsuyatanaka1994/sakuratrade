from __future__ import annotations

from collections.abc import AsyncGenerator, Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import get_settings

settings = get_settings()


def _engine_kwargs() -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "echo": settings.database_echo,
        "pool_pre_ping": settings.db_pool_pre_ping,
    }
    if settings.db_pool_recycle is not None:
        kwargs["pool_recycle"] = settings.db_pool_recycle
    if settings.db_pool_timeout is not None:
        kwargs["pool_timeout"] = settings.db_pool_timeout
    return kwargs


_async_engine_kwargs = _engine_kwargs()
_async_engine = create_async_engine(settings.async_database_url, **_async_engine_kwargs)
async_session_factory = async_sessionmaker(_async_engine, expire_on_commit=False)

_sync_engine_kwargs = _engine_kwargs()
_sync_engine = create_engine(settings.sync_database_url, **_sync_engine_kwargs)
session_factory = sessionmaker(autocommit=False, autoflush=False, bind=_sync_engine)


async def get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        yield session


def get_db() -> Generator[Session, None, None]:
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


async_engine = _async_engine
sync_engine = _sync_engine
