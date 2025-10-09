"""normalize schema for uuid-centric identifiers

Revision ID: 7e3c9d9b02f0
Revises: 42efb5df5908
Create Date: 2025-10-09 09:30:00.000000

"""

from __future__ import annotations

revision = "7e3c9d9b02f0"
down_revision = "c3a1f8e7d24b"
branch_labels = None
depends_on = None

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

UUID_TYPE = postgresql.UUID(as_uuid=False)
LOCK_TIMEOUT = "5s"


def _set_lock_timeout(bind: sa.Connection) -> None:
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'"))


def upgrade() -> None:
    bind = op.get_bind()
    _set_lock_timeout(bind)
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))

    # Drop legacy FK/index pointing to numeric ids
    with op.batch_alter_table("trades") as batch_op:
        try:
            batch_op.drop_constraint("fk_trades_user_id", type_="foreignkey")
        except Exception:  # noqa: BLE001
            pass
        try:
            batch_op.drop_index("ix_trades_user_id")
        except Exception:  # noqa: BLE001
            pass

    with op.batch_alter_table("chats") as batch_op:
        try:
            batch_op.drop_constraint("fk_chats_user_id", type_="foreignkey")
        except Exception:  # noqa: BLE001
            pass
        try:
            batch_op.drop_index("ix_chats_user_id")
        except Exception:  # noqa: BLE001
            pass

    # Stage uuid columns for child tables
    op.add_column("trades", sa.Column("user_id_uuid", UUID_TYPE, nullable=True))
    op.add_column("chats", sa.Column("user_id_uuid", UUID_TYPE, nullable=True))

    bind.execute(
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

    bind.execute(
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

    # Prepare users table for uuid primary key
    try:
        op.drop_constraint("uq_users_user_uuid", "users", type_="unique")
    except Exception:  # noqa: BLE001
        pass

    try:
        op.drop_constraint("users_pkey", "users", type_="primary")
    except Exception:  # noqa: BLE001
        pass

    op.alter_column("users", "user_id", new_column_name="legacy_user_id")
    op.alter_column("users", "user_uuid", new_column_name="user_id")

    op.add_column("users", sa.Column("user_uuid", UUID_TYPE, nullable=True))
    bind.execute(sa.text("UPDATE users SET user_uuid = user_id"))
    op.alter_column("users", "user_uuid", nullable=False)
    op.create_unique_constraint("uq_users_user_uuid", "users", ["user_uuid"])
    op.create_primary_key("users_pkey", "users", ["user_id"])

    op.execute(sa.text("ALTER TABLE users ALTER COLUMN user_id SET DEFAULT gen_random_uuid()"))
    op.execute(sa.text("ALTER TABLE users ALTER COLUMN user_uuid SET DEFAULT NULL"))
    op.execute(
        sa.text(
            """
            CREATE OR REPLACE FUNCTION sync_users_uuid()
            RETURNS TRIGGER AS $$
            BEGIN
                IF NEW.user_id IS NULL AND NEW.user_uuid IS NULL THEN
                    NEW.user_id := gen_random_uuid();
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
        )
    )
    op.execute(
        sa.text(
            """
            DROP TRIGGER IF EXISTS trg_users_sync_uuid ON users;
            CREATE TRIGGER trg_users_sync_uuid
            BEFORE INSERT OR UPDATE ON users
            FOR EACH ROW
            EXECUTE FUNCTION sync_users_uuid();
            """
        )
    )

    # Promote uuid columns to be authoritative
    with op.batch_alter_table("trades") as batch_op:
        batch_op.drop_column("user_id")
        batch_op.alter_column("user_id_uuid", new_column_name="user_id", existing_type=UUID_TYPE)
        batch_op.create_index("ix_trades_user_id", ["user_id"], unique=False)
        batch_op.create_foreign_key("fk_trades_user_id", "users", ["user_id"], ["user_id"], ondelete="SET NULL")

    with op.batch_alter_table("chats") as batch_op:
        batch_op.drop_column("user_id")
        batch_op.alter_column("user_id_uuid", new_column_name="user_id", existing_type=UUID_TYPE)
        batch_op.create_index("ix_chats_user_id", ["user_id"], unique=False)
        batch_op.create_foreign_key("fk_chats_user_id", "users", ["user_id"], ["user_id"], ondelete="SET NULL")

    # Ensure trade UUIDs are enforced
    op.alter_column("trades", "trade_uuid", nullable=False)
    try:
        op.drop_constraint("uq_trades_trade_uuid", "trades", type_="unique")
    except Exception:  # noqa: BLE001
        pass
    op.create_unique_constraint("uq_trades_trade_uuid", "trades", ["trade_uuid"])
    op.execute(sa.text("ALTER TABLE trades ALTER COLUMN trade_uuid SET DEFAULT gen_random_uuid()"))

    with op.batch_alter_table("trade_journal") as batch_op:
        try:
            batch_op.drop_constraint("uq_trade_journal_trade_id", type_="unique")
        except Exception:  # noqa: BLE001
            pass
        batch_op.alter_column("trade_uuid", existing_type=UUID_TYPE, nullable=False)
        batch_op.create_unique_constraint("uq_trade_journal_trade_uuid", ["trade_uuid"])

    # Remove legacy numeric id column from users
    op.drop_column("users", "legacy_user_id")


def downgrade() -> None:
    raise RuntimeError("Downgrade is unavailable for UUID normalization")
