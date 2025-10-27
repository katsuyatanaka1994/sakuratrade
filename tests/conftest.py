import os
from uuid import UUID

import pytest
import pytest_asyncio
from sqlalchemy import text

from app.database import async_engine, sync_engine

os.environ.setdefault("ENV", "test")

DUMMY_USER = UUID("00000000-0000-0000-0000-000000000000")
DUMMY_EMAIL = "dummy@gptset.local"


@pytest_asyncio.fixture(scope="session", autouse=True, loop_scope="session")
async def dispose_async_engine() -> None:
    yield
    await async_engine.dispose()


@pytest.fixture(scope="function", autouse=True)
def verify_database_ready(request: pytest.FixtureRequest):
    if request.node.get_closest_marker("no_db"):
        yield
        return

    try:
        with sync_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - handled in test summary
        pytest.skip(f"PostgreSQL database is not reachable: {exc}")
    else:
        yield


@pytest.fixture(autouse=True)
def prepare_test_state(request: pytest.FixtureRequest):
    if request.node.get_closest_marker("no_db"):
        yield
        return

    try:
        with sync_engine.begin() as conn:
            exists = conn.scalar(text("SELECT to_regclass('public.chat_messages')"))
            if exists is None:
                pytest.skip("Database schema not migrated (chat_messages table missing)")

            conn.execute(
                text(
                    """
                    TRUNCATE TABLE chat_messages, chats, trade_journal, alerts,
                    pattern_results, images, trades, users CASCADE
                    """
                )
            )
            conn.execute(
                text(
                    """
                    INSERT INTO users (user_id, user_uuid, email)
                    VALUES (:uid, :uid, :email)
                    ON CONFLICT (user_id) DO NOTHING
                    """
                ),
                {"uid": str(DUMMY_USER), "email": DUMMY_EMAIL},
            )
            conn.execute(
                text("UPDATE users SET user_id = :uid, user_uuid = :uid WHERE email = :email"),
                {"uid": str(DUMMY_USER), "email": DUMMY_EMAIL},
            )
    except Exception as exc:  # pragma: no cover - skip keeps test output noise minimal
        pytest.skip(f"PostgreSQL database setup not available: {exc}")
    else:
        yield
