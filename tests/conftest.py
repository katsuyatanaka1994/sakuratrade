import asyncio
import os
import pathlib
import sqlite3
import sys
import uuid

import pytest

PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]

TEST_DB_DIR = PROJECT_ROOT / ".pytest_db"
TEST_DB_DIR.mkdir(parents=True, exist_ok=True)
TEST_DB_PATH = TEST_DB_DIR / "test.db"

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Ensure a predictable test environment
os.environ["APP_ENV"] = "test"
# Use a dedicated, writable path for the SQLite test DB
os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{TEST_DB_PATH}"

# Ensure sqlite3 can bind uuid.UUID parameters (SQLite has no native UUID type)

try:
    sqlite3.register_adapter(uuid.UUID, lambda u: str(u))
except Exception:
    pass

# Nuke stale SQLite file to avoid schema drift between test runs
try:
    _db_file = TEST_DB_PATH
    if _db_file.exists():
        _db_file.unlink()
except Exception:
    # Non-fatal; reset fixture below also drops/creates tables
    pass

try:
    TEST_DB_DIR.chmod(0o700)
except Exception:
    pass

# Try to import Base/engine and models, then create tables.
# We attempt multiple conventional locations for models to ensure metadata is populated.
try:
    from app.db.base import Base  # type: ignore
except Exception:
    Base = None  # type: ignore

engine = None
try:
    from app.db.session import engine as _engine  # type: ignore

    engine = _engine
except Exception:
    pass

engine_deps = None
try:
    from app.deps import engine as _engine_deps  # type: ignore

    engine_deps = _engine_deps
except Exception:
    pass

# Best-effort import of models so Base.metadata is aware of all tables
for _mod in (
    # primary, package-level aggregators
    "app.db.models",
    "app.models",
    "app.database.models",
    # common per-model modules (try several likely names)
    "app.db.models.trade",
    "app.db.models.trades",
    "app.models.trade",
    "app.models.trades",
    # sometimes models live under `tables` or similar
    "app.db.tables",
    "app.database.tables",
):
    try:
        __import__(_mod)
    except Exception:
        pass


# Utilities to create/drop tables for both SyncEngine and AsyncEngine
def _get_sync_bind(bind):
    return getattr(bind, "sync_engine", bind)


def _create_all(Base, engine):
    if Base is None or engine is None:
        return
    try:
        # AsyncEngine path
        if hasattr(engine, "begin") and callable(getattr(engine, "begin")):

            async def _go():
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)

            asyncio.run(_go())
        else:
            # Sync engine path
            Base.metadata.create_all(bind=_get_sync_bind(engine))
    except Exception:
        pass


# Initial one-time create_all before tests start
_create_all(Base, engine)
_create_all(Base, engine_deps)


# --- Ensure required ad-hoc tables exist even if ORM models are absent ---
def _ensure_trades_table(engine):
    """Create a minimal 'trades' table via raw DDL for SQLite if not present.
    This is a test-only safety net when ORM models are not available.
    """
    if engine is None:
        return

    ddl = """
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,

            -- camelCase columns (payload compatibility)
            tradeId INTEGER,
            userId TEXT,
            ticker TEXT NOT NULL,
            stock_code TEXT,
            side   TEXT NOT NULL,
            priceIn REAL,
            size REAL,
            enteredAt TEXT,

            -- snake_case / normalized mirrors (router/schema吸収用)
            trade_id TEXT,
            user_id TEXT,
            quantity REAL,
            price_in REAL,
            entry_price REAL,
            price_out REAL,
            entered_at TEXT,
            exited_at TEXT,
            description TEXT,
            created_at TEXT
        );
        """

    try:
        # AsyncEngine path
        if hasattr(engine, "begin") and callable(getattr(engine, "begin")):

            async def _go():
                async with engine.begin() as conn:
                    await conn.exec_driver_sql(ddl)

            asyncio.run(_go())
        else:
            # Sync Engine path
            with engine.begin() as conn:
                conn.exec_driver_sql(ddl)
    except Exception:
        # Silent: tests will surface issues if this fails in practice
        pass


def _ensure_chats_tables(engine):
    """Create minimal 'chats' and 'chat_messages' tables for tests if ORM models are absent."""
    if engine is None:
        return

    ddl_chats = """
        CREATE TABLE IF NOT EXISTS chats (
            id TEXT PRIMARY KEY,
            name TEXT,
            user_id TEXT,
            messages_json TEXT,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        );
        """

    ddl_chat_messages = """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            type TEXT NOT NULL,
            author_id TEXT,
            text TEXT,
            payload TEXT,           -- store JSON as TEXT for SQLite
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT,
            is_deleted INTEGER DEFAULT 0
        );
        """

    try:
        if hasattr(engine, "begin") and callable(getattr(engine, "begin")):

            async def _go():
                async with engine.begin() as conn:
                    await conn.exec_driver_sql(ddl_chats)
                    await conn.exec_driver_sql(ddl_chat_messages)

            asyncio.run(_go())
        else:
            with engine.begin() as conn:
                conn.exec_driver_sql(ddl_chats)
                conn.exec_driver_sql(ddl_chat_messages)
    except Exception:
        pass


# Ensure ad-hoc tables once before tests start
_ensure_trades_table(engine)
_ensure_trades_table(engine_deps)
_ensure_chats_tables(engine)
_ensure_chats_tables(engine_deps)


@pytest.fixture
def anyio_backend():
    """Force AnyIO tests to run with the asyncio backend during CI runs."""
    return "asyncio"


# Autouse fixture to reset DB schema between tests
@pytest.fixture(autouse=True)
def _reset_db_between_tests():
    """Ensure a clean schema for each test when Base/engine are available."""
    try:
        from app.db.base import Base  # type: ignore
        from app.db.session import engine  # type: ignore
    except Exception:
        yield
        return

    try:

        def _sync_bind(b):
            return getattr(b, "sync_engine", b)

        # AsyncEngine path
        if hasattr(engine, "begin") and callable(getattr(engine, "begin")):

            async def _go():
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.drop_all)
                    await conn.run_sync(Base.metadata.create_all)
                    await conn.exec_driver_sql("DROP TABLE IF EXISTS trades;")
                    await conn.exec_driver_sql(
                        """
                        CREATE TABLE trades (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            tradeId INTEGER,
                            userId TEXT,
                            ticker TEXT NOT NULL,
                            stock_code TEXT,
                            side   TEXT NOT NULL,
                            priceIn REAL,
                            size REAL,
                            enteredAt TEXT,
                            trade_id TEXT,
                            user_id TEXT,
                            quantity REAL,
                            price_in REAL,
                            entry_price REAL,
                            price_out REAL,
                            entered_at TEXT,
                            exited_at TEXT,
                            description TEXT,
                            created_at TEXT
                        );
                        """
                    )
                    await conn.exec_driver_sql("DROP TABLE IF EXISTS chat_messages;")
                    await conn.exec_driver_sql("DROP TABLE IF EXISTS chats;")
                    await conn.exec_driver_sql(
                        """
                        CREATE TABLE chats (
                            id TEXT PRIMARY KEY,
                            name TEXT,
                            user_id TEXT,
                            messages_json TEXT,
                            created_at TEXT,
                            updated_at TEXT,
                            deleted_at TEXT
                        );
                        """
                    )
                    await conn.exec_driver_sql(
                        """
                        CREATE TABLE chat_messages (
                            id TEXT PRIMARY KEY,
                            chat_id TEXT NOT NULL,
                            type TEXT NOT NULL,
                            author_id TEXT,
                            text TEXT,
                            payload TEXT,           -- store JSON as TEXT for SQLite
                            created_at TEXT,
                            updated_at TEXT,
                            deleted_at TEXT,
                            is_deleted INTEGER DEFAULT 0
                        );
                        """
                    )
                # Ensure DB file remains writable between tests (avoid readonly issues)
                try:
                    if TEST_DB_PATH.exists():
                        TEST_DB_PATH.chmod(0o600)
                except Exception:
                    pass

            asyncio.run(_go())
        else:
            # Sync engine path
            bind = _sync_bind(engine)
            Base.metadata.drop_all(bind=bind)
            Base.metadata.create_all(bind=bind)
            with bind.begin() as conn:
                conn.exec_driver_sql("DROP TABLE IF EXISTS trades;")
                conn.exec_driver_sql(
                    """
                    CREATE TABLE trades (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        tradeId INTEGER,
                        userId TEXT,
                        ticker TEXT NOT NULL,
                        stock_code TEXT,
                        side   TEXT NOT NULL,
                        priceIn REAL,
                        size REAL,
                        enteredAt TEXT,
                        trade_id TEXT,
                        user_id TEXT,
                        quantity REAL,
                        price_in REAL,
                        entry_price REAL,
                        price_out REAL,
                        entered_at TEXT,
                        exited_at TEXT,
                        description TEXT,
                        created_at TEXT
                    );
                    """
                )
                conn.exec_driver_sql("DROP TABLE IF EXISTS chat_messages;")
                conn.exec_driver_sql("DROP TABLE IF EXISTS chats;")
                conn.exec_driver_sql(
                    """
                    CREATE TABLE chats (
                        id TEXT PRIMARY KEY,
                        name TEXT,
                        user_id TEXT,
                        messages_json TEXT,
                        created_at TEXT,
                        updated_at TEXT,
                        deleted_at TEXT
                    );
                    """
                )
                conn.exec_driver_sql(
                    """
                    CREATE TABLE chat_messages (
                        id TEXT PRIMARY KEY,
                        chat_id TEXT NOT NULL,
                        type TEXT NOT NULL,
                        author_id TEXT,
                        text TEXT,
                        payload TEXT,           -- store JSON as TEXT for SQLite
                        created_at TEXT,
                        updated_at TEXT,
                        deleted_at TEXT,
                        is_deleted INTEGER DEFAULT 0
                    );
                    """
                )
            # Ensure DB file remains writable between tests (avoid readonly issues)
            try:
                if TEST_DB_PATH.exists():
                    TEST_DB_PATH.chmod(0o600)
            except Exception:
                pass

        # Also reset/ensure schema on engine_deps if the app uses a separate engine
        try:
            if "engine_deps" in globals() and engine_deps is not None:
                if hasattr(engine_deps, "begin") and callable(getattr(engine_deps, "begin")):

                    async def _go2():
                        async with engine_deps.begin() as conn:
                            await conn.run_sync(Base.metadata.drop_all)
                            await conn.run_sync(Base.metadata.create_all)
                            await conn.exec_driver_sql("DROP TABLE IF EXISTS trades;")
                            await conn.exec_driver_sql(
                                """
                                CREATE TABLE trades (
                                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                                    tradeId INTEGER,
                                    userId TEXT,
                                    ticker TEXT NOT NULL,
                                    stock_code TEXT,
                                    side   TEXT NOT NULL,
                                    priceIn REAL,
                                    size REAL,
                                    enteredAt TEXT,
                                    trade_id TEXT,
                                    user_id TEXT,
                                    quantity REAL,
                                    price_in REAL,
                                    entry_price REAL,
                                    price_out REAL,
                                    entered_at TEXT,
                                    exited_at TEXT,
                                    description TEXT,
                                    created_at TEXT
                                );
                                """
                            )
                            await conn.exec_driver_sql("DROP TABLE IF EXISTS chat_messages;")
                            await conn.exec_driver_sql("DROP TABLE IF EXISTS chats;")
                            await conn.exec_driver_sql(
                                """
                                CREATE TABLE chats (
                                    id TEXT PRIMARY KEY,
                                    name TEXT,
                                    user_id TEXT,
                                    messages_json TEXT,
                                    created_at TEXT,
                                    updated_at TEXT,
                                    deleted_at TEXT
                                );
                                """
                            )
                            await conn.exec_driver_sql(
                                """
                                CREATE TABLE chat_messages (
                                    id TEXT PRIMARY KEY,
                                    chat_id TEXT NOT NULL,
                                    type TEXT NOT NULL,
                                    author_id TEXT,
                                    text TEXT,
                                    payload TEXT,           -- store JSON as TEXT for SQLite
                                    created_at TEXT,
                                    updated_at TEXT,
                                    deleted_at TEXT,
                                    is_deleted INTEGER DEFAULT 0
                                );
                                """
                            )

                    asyncio.run(_go2())
                else:
                    bind2 = getattr(engine_deps, "sync_engine", engine_deps)
                    Base.metadata.drop_all(bind=bind2)
                    Base.metadata.create_all(bind=bind2)
                    with bind2.begin() as conn:
                        conn.exec_driver_sql("DROP TABLE IF EXISTS trades;")
                        conn.exec_driver_sql(
                            """
                            CREATE TABLE trades (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                tradeId INTEGER,
                                userId TEXT,
                                ticker TEXT NOT NULL,
                                stock_code TEXT,
                                side   TEXT NOT NULL,
                                priceIn REAL,
                                size REAL,
                                enteredAt TEXT,
                                trade_id TEXT,
                                user_id TEXT,
                                quantity REAL,
                                price_in REAL,
                                entry_price REAL,
                                price_out REAL,
                                entered_at TEXT,
                                exited_at TEXT,
                                description TEXT,
                                created_at TEXT
                            );
                            """
                        )
                        conn.exec_driver_sql("DROP TABLE IF EXISTS chat_messages;")
                        conn.exec_driver_sql("DROP TABLE IF EXISTS chats;")
                        conn.exec_driver_sql(
                            """
                            CREATE TABLE chats (
                                id TEXT PRIMARY KEY,
                                name TEXT,
                                user_id TEXT,
                                messages_json TEXT,
                                created_at TEXT,
                                updated_at TEXT,
                                deleted_at TEXT
                            );
                            """
                        )
                        conn.exec_driver_sql(
                            """
                            CREATE TABLE chat_messages (
                                id TEXT PRIMARY KEY,
                                chat_id TEXT NOT NULL,
                                type TEXT NOT NULL,
                                author_id TEXT,
                                text TEXT,
                                payload TEXT,           -- store JSON as TEXT for SQLite
                                created_at TEXT,
                                updated_at TEXT,
                                deleted_at TEXT,
                                is_deleted INTEGER DEFAULT 0
                            );
                            """
                        )
        except Exception:
            pass
    except Exception:
        pass
    yield


# Fixture to satisfy tests that request 'indicators'
@pytest.fixture
def indicators():
    # Minimal structure consumed by tests/templates
    return [
        {"name": "RSI", "value": 75, "evaluation": "強気", "comment": "テスト用RSI"},
        {"name": "トレンド", "value": "上昇トレンド", "evaluation": "強気", "comment": "テスト用トレンド"},
    ]
