import asyncio
import os
import pathlib
import sqlite3
import sys
import uuid

import pytest
import sqlalchemy as sa

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]

TEST_DB_DIR = PROJECT_ROOT / ".pytest_db"
TEST_DB_DIR.mkdir(parents=True, exist_ok=True)
TEST_DB_PATH = TEST_DB_DIR / "test.db"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

os.environ.setdefault("APP_ENV", "test")
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"
os.environ.setdefault("DATABASE_URL_ASYNC", os.environ["DATABASE_URL"])

try:
    sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
except Exception:
    pass

DUMMY_USER = uuid.UUID("00000000-0000-0000-0000-000000000000")


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture(autouse=True)
def _reset_db_between_tests():
    """Ensure ORM metadata is applied freshly for each test run."""
    try:
        from app.db.base import Base  # type: ignore
        from app.db.session import engine  # type: ignore
    except Exception:
        yield
        return

    async def _drop_create(async_engine):
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            await conn.run_sync(Base.metadata.create_all)
            await conn.execute(
                sa.text(
                    """
                    INSERT OR IGNORE INTO users (user_id, user_uuid, email)
                    VALUES (:uid, :uuid, :email)
                    """
                ),
                {
                    "uid": str(DUMMY_USER),
                    "uuid": str(DUMMY_USER),
                    "email": "dummy@gptset.local",
                },
            )

    def _drop_create_sync(sync_engine):
        bind = getattr(sync_engine, "sync_engine", sync_engine)
        Base.metadata.drop_all(bind=bind)
        Base.metadata.create_all(bind=bind)
        with bind.begin() as conn:
            conn.execute(
                sa.text(
                    """
                    INSERT OR IGNORE INTO users (user_id, user_uuid, email)
                    VALUES (:uid, :uuid, :email)
                    """
                ),
                {
                    "uid": str(DUMMY_USER),
                    "uuid": str(DUMMY_USER),
                    "email": "dummy@gptset.local",
                },
            )

    try:
        if hasattr(engine, "begin") and callable(getattr(engine, "begin")):
            asyncio.run(_drop_create(engine))
        else:
            _drop_create_sync(engine)

        deps_engine = globals().get("engine_deps")
        if deps_engine is not None:
            if hasattr(deps_engine, "begin") and callable(getattr(deps_engine, "begin")):
                asyncio.run(_drop_create(deps_engine))
            else:
                _drop_create_sync(deps_engine)
    finally:
        try:
            if TEST_DB_PATH.exists():
                TEST_DB_PATH.chmod(0o600)
        except Exception:
            pass
        yield


@pytest.fixture
def indicators():
    return [
        {"name": "RSI", "value": 75, "evaluation": "強気", "comment": "テスト用RSI"},
        {"name": "トレンド", "value": "上昇トレンド", "evaluation": "強気", "comment": "テスト用トレンド"},
    ]
