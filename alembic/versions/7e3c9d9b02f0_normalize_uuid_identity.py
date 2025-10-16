"""normalize schema for uuid-centric identifiers

Revision ID: 7e3c9d9b02f0
Revises: 42efb5df5908
Create Date: 2025-10-09 09:30:00.000000

"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "7e3c9d9b02f0"
down_revision = "42efb5df5908"
branch_labels = None
depends_on = None

UUID_TYPE = postgresql.UUID(as_uuid=False)
LOCK_TIMEOUT = "5s"


def _set_lock_timeout(bind: sa.Connection) -> None:
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'"))


def _ensure_uuid_extension(bind: sa.Connection) -> str | None:
    if bind.dialect.name != "postgresql":
        return None

    for extension, function in (("pgcrypto", "gen_random_uuid()"), ('"uuid-ossp"', "uuid_generate_v4()")):
        try:
            bind.execute(sa.text(f"CREATE EXTENSION IF NOT EXISTS {extension}"))
            return function
        except Exception:  # noqa: BLE001
            continue
    return None


def _has_column(bind: sa.Connection, table: str, column: str) -> bool:
    inspector = sa.inspect(bind)
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    _set_lock_timeout(bind)
    uuid_function = _ensure_uuid_extension(bind)
    uuid_expr = uuid_function or "uuid_in(md5(random()::text || clock_timestamp()::text)::cstring)"

    temporary_defaults = [
        ("images", "s3_url", "''::text"),
        ("images", "uploaded_at", "TIMEZONE('utc', NOW())"),
        ("pattern_results", "rule", "''::text"),
        ("pattern_results", "score", "0"),
        ("pattern_results", "diagnosed_at", "TIMEZONE('utc', NOW())"),
        ("alerts", "type", "''::text"),
        ("alerts", "target_price", "0"),
        ("trade_journal", "chat_id", "''::text"),
    ]

    for table, column, expression in temporary_defaults:
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} SET DEFAULT {expression}"))
        op.execute(sa.text(f"UPDATE {table} SET {column} = {expression} WHERE {column} IS NULL"))

    # Drop child foreign keys referencing trades before altering parent constraints
    child_fk_constraints = [
        ("images", "fk_images_trade_uuid"),
        ("pattern_results", "fk_pattern_results_trade_uuid"),
        ("alerts", "fk_alerts_trade_uuid"),
        ("trade_journal", "fk_trade_journal_trade_uuid"),
    ]
    legacy_fk_constraints = [
        ("images", "fk_images_trade_id"),
        ("pattern_results", "fk_pattern_results_trade_id"),
        ("alerts", "fk_alerts_trade_id"),
        ("trade_journal", "fk_trade_journal_trade_id"),
    ]
    for table, constraint in child_fk_constraints + legacy_fk_constraints:
        op.execute(sa.text(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint}"))
    op.execute(sa.text("ALTER TABLE trade_journal DROP CONSTRAINT IF EXISTS uq_trade_journal_trade_uuid"))

    # Remove references from chats/trades to users prior to rebuilding
    op.execute(sa.text("ALTER TABLE trades DROP CONSTRAINT IF EXISTS fk_trades_user_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_trades_user_id"))
    op.execute(sa.text("ALTER TABLE chats DROP CONSTRAINT IF EXISTS fk_chats_user_id"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_chats_user_id"))
    op.execute(sa.text("ALTER TABLE trade_journal DROP CONSTRAINT IF EXISTS fk_trade_journal_user_id"))
    op.execute(sa.text("ALTER TABLE trade_journal DROP CONSTRAINT IF EXISTS uq_trade_journal_trade_id"))

    if not _has_column(bind, "trades", "user_id_uuid"):
        op.add_column("trades", sa.Column("user_id_uuid", UUID_TYPE, nullable=True))
    if not _has_column(bind, "chats", "user_id_uuid"):
        op.add_column("chats", sa.Column("user_id_uuid", UUID_TYPE, nullable=True))

    op.execute(
        sa.text(
            """
            UPDATE trades AS t
            SET user_id_uuid = u.user_uuid
            FROM users AS u
            WHERE t.user_id IS NOT NULL
              AND u.user_id = t.user_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            UPDATE chats AS c
            SET user_id_uuid = u.user_uuid
            FROM users AS u
            WHERE c.user_id IS NOT NULL
              AND u.user_id = c.user_id
            """
        )
    )

    op.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_user_uuid"))
    op.execute(sa.text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey"))

    if _has_column(bind, "users", "user_id"):
        op.alter_column("users", "user_id", new_column_name="legacy_user_id")
    if _has_column(bind, "users", "user_uuid"):
        op.alter_column("users", "user_uuid", new_column_name="user_id")

    if not _has_column(bind, "users", "user_uuid"):
        op.add_column("users", sa.Column("user_uuid", UUID_TYPE, nullable=True))

    op.execute(sa.text("UPDATE users SET user_uuid = user_id WHERE user_uuid IS NULL"))
    op.alter_column("users", "user_uuid", nullable=False)
    op.create_unique_constraint("uq_users_user_uuid", "users", ["user_uuid"])
    op.create_primary_key("users_pkey", "users", ["user_id"])

    op.execute(sa.text(f"ALTER TABLE users ALTER COLUMN user_id SET DEFAULT {uuid_expr}"))
    op.execute(sa.text(f"ALTER TABLE users ALTER COLUMN user_uuid SET DEFAULT {uuid_expr}"))

    function_sql = f"""
        CREATE OR REPLACE FUNCTION sync_users_uuid()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.user_id IS NULL AND NEW.user_uuid IS NULL THEN
                NEW.user_id := {uuid_expr};
                NEW.user_uuid := NEW.user_id;
            ELSIF NEW.user_id IS NULL THEN
                NEW.user_id := NEW.user_uuid;
            ELSIF NEW.user_uuid IS NULL THEN
                NEW.user_uuid := NEW.user_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """
    op.execute(sa.text(function_sql))
    op.execute(sa.text("DROP TRIGGER IF EXISTS trg_users_sync_uuid ON users"))
    op.execute(
        sa.text(
            "CREATE TRIGGER trg_users_sync_uuid "
            "BEFORE INSERT OR UPDATE ON users "
            "FOR EACH ROW EXECUTE FUNCTION sync_users_uuid()"
        )
    )

    with op.batch_alter_table("trades") as batch_op:
        if _has_column(bind, "trades", "user_id"):
            batch_op.drop_column("user_id")
        batch_op.alter_column("user_id_uuid", new_column_name="user_id", existing_type=UUID_TYPE)

    op.create_index("ix_trades_user_id", "trades", ["user_id"], unique=False)
    op.create_foreign_key(
        "fk_trades_user_id",
        "trades",
        "users",
        ["user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )

    op.alter_column("trades", "trade_uuid", nullable=False)
    op.execute(sa.text(f"ALTER TABLE trades ALTER COLUMN trade_uuid SET DEFAULT {uuid_expr}"))
    op.execute(sa.text("ALTER TABLE trades DROP CONSTRAINT IF EXISTS uq_trades_trade_uuid"))
    op.execute(sa.text("ALTER TABLE trades DROP CONSTRAINT IF EXISTS trades_pkey"))
    op.execute(sa.text("ALTER TABLE trades ADD CONSTRAINT trades_pkey PRIMARY KEY (trade_uuid)"))
    op.create_unique_constraint("uq_trades_trade_uuid", "trades", ["trade_uuid"])

    with op.batch_alter_table("chats") as batch_op:
        if _has_column(bind, "chats", "user_id"):
            batch_op.drop_column("user_id")
        batch_op.alter_column("user_id_uuid", new_column_name="user_id", existing_type=UUID_TYPE)
    op.create_index("ix_chats_user_id", "chats", ["user_id"], unique=False)
    op.create_foreign_key(
        "fk_chats_user_id",
        "chats",
        "users",
        ["user_id"],
        ["user_id"],
        ondelete="SET NULL",
    )

    op.alter_column("images", "trade_uuid", nullable=False)
    op.alter_column("pattern_results", "trade_uuid", nullable=False)
    op.alter_column("alerts", "trade_uuid", nullable=False)
    op.alter_column("trade_journal", "trade_uuid", nullable=False)

    if _has_column(bind, "trade_journal", "user_id"):
        op.execute(
            sa.text(
                """
                UPDATE trade_journal AS tj
                SET user_id = u.user_id::text
                FROM users AS u
                WHERE tj.user_id = u.legacy_user_id::text
                """
            )
        )
        op.alter_column(
            "trade_journal",
            "user_id",
            type_=UUID_TYPE,
            postgresql_using="NULLIF(user_id, '')::uuid",
            nullable=True,
        )
        op.create_foreign_key(
            "fk_trade_journal_user_id",
            "trade_journal",
            "users",
            ["user_id"],
            ["user_id"],
            ondelete="SET NULL",
        )
    for table, constraint in child_fk_constraints:
        op.create_foreign_key(
            constraint,
            table,
            "trades",
            ["trade_uuid"],
            ["trade_uuid"],
            ondelete="CASCADE",
            deferrable=True,
            initially="IMMEDIATE",
        )

    op.create_unique_constraint("uq_trade_journal_trade_uuid", "trade_journal", ["trade_uuid"])

    if _has_column(bind, "users", "legacy_user_id"):
        op.drop_column("users", "legacy_user_id")

    for table, column, _ in temporary_defaults:
        op.execute(sa.text(f"ALTER TABLE {table} ALTER COLUMN {column} DROP DEFAULT"))


def downgrade() -> None:
    raise RuntimeError("UUID normalization migration cannot be downgraded safely")
