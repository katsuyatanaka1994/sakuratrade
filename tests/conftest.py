import os
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.database import async_engine, async_session_factory

os.environ.setdefault("ENV", "test")

DUMMY_USER = UUID("00000000-0000-0000-0000-000000000000")


@pytest_asyncio.fixture(scope="session", autouse=True)
async def verify_database_ready():
    try:
        async with async_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - handled in test summary
        pytest.skip(f"PostgreSQL database is not reachable: {exc}")


@pytest_asyncio.fixture(autouse=True)
async def prepare_test_state():
    async with async_session_factory() as session:
        await session.execute(text("TRUNCATE trades CASCADE"))
        await session.execute(text("TRUNCATE trade_journal CASCADE"))
        await session.execute(text("TRUNCATE images CASCADE"))
        await session.execute(text("TRUNCATE pattern_results CASCADE"))
        await session.execute(text("TRUNCATE alerts CASCADE"))
        await session.execute(
            text(
                """
                INSERT INTO users (user_id, user_uuid, email)
                VALUES (:uid, :uid, :email)
                ON CONFLICT (user_id) DO NOTHING
                """
            ),
            {"uid": str(DUMMY_USER), "email": "dummy@gptset.local"},
        )
        await session.commit()
    yield
