"""introduce uuid companion columns with batch migration

Revision ID: c3a1f8e7d24b
Revises: 690ffec9e9e7
Create Date: 2025-10-08 11:45:00.000000

"""

from __future__ import annotations

import os
import uuid
from typing import Iterable

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "c3a1f8e7d24b"
down_revision = "690ffec9e9e7"
branch_labels = None
depends_on = None

BATCH_SIZE = int(os.environ.get("MIGRATION_BATCH_SIZE", "1000"))
LOCK_TIMEOUT = os.environ.get("MIGRATION_LOCK_TIMEOUT", "5s")
UUID_TYPE = postgresql.UUID(as_uuid=False)
UUID_SQL_FUNCTION = "gen_random_uuid()"


def _set_lock_timeout(bind: sa.Connection) -> None:
    if bind.dialect.name == "postgresql":
        bind.execute(sa.text(f"SET LOCAL lock_timeout = '{LOCK_TIMEOUT}'"))


def _ensure_uuid_extension(bind: sa.Connection) -> None:
    global UUID_SQL_FUNCTION
    if bind.dialect.name != "postgresql":
        return
    try:
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pgcrypto"))
        UUID_SQL_FUNCTION = "gen_random_uuid()"
    except Exception:
        try:
            bind.execute(sa.text('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"'))
            UUID_SQL_FUNCTION = "uuid_generate_v4()"
        except Exception:
            UUID_SQL_FUNCTION = None


def _assign_random_uuid(
    bind: sa.Connection,
    *,
    table: str,
    pk_column: str,
    uuid_column: str,
) -> None:
    last_pk = None
    while True:
        if last_pk is None:
            rows = (
                bind.execute(
                    sa.text(
                        f"SELECT {pk_column} AS pk FROM {table} "
                        f"WHERE {uuid_column} IS NULL ORDER BY {pk_column} LIMIT :limit"
                    ),
                    {"limit": BATCH_SIZE},
                )
                .mappings()
                .all()
            )
        else:
            rows = (
                bind.execute(
                    sa.text(
                        f"SELECT {pk_column} AS pk FROM {table} "
                        f"WHERE {uuid_column} IS NULL AND {pk_column} > :last_pk "
                        f"ORDER BY {pk_column} LIMIT :limit"
                    ),
                    {"limit": BATCH_SIZE, "last_pk": last_pk},
                )
                .mappings()
                .all()
            )

        if not rows:
            break

        payload = [{"uuid": str(uuid.uuid4()), "pk": row["pk"]} for row in rows]
        bind.execute(
            sa.text(f"UPDATE {table} SET {uuid_column} = :uuid " f"WHERE {pk_column} = :pk"),
            payload,
        )
        last_pk = rows[-1]["pk"]


def _fill_child_uuid(bind: sa.Connection, table: str) -> None:
    bind.execute(
        sa.text(
            f"""
            UPDATE {table} AS child
            SET trade_uuid = parent.trade_uuid
            FROM trades AS parent
            WHERE child.trade_uuid IS NULL
              AND child.trade_id = parent.trade_id
            """
        )
    )


def _ensure_constraint(bind: sa.Connection, table: str, name: str, columns: Iterable[str]) -> None:
    inspector = sa.inspect(bind)
    existing = {constraint["name"] for constraint in inspector.get_unique_constraints(table)}
    if name not in existing:
        op.create_unique_constraint(name, table, list(columns))


def upgrade() -> None:
    bind = op.get_bind()
    _set_lock_timeout(bind)
    _ensure_uuid_extension(bind)

    op.add_column("users", sa.Column("user_uuid", UUID_TYPE, nullable=True))
    op.add_column("trades", sa.Column("trade_uuid", UUID_TYPE, nullable=True))
    op.add_column("images", sa.Column("trade_uuid", UUID_TYPE, nullable=True))
    op.add_column("pattern_results", sa.Column("trade_uuid", UUID_TYPE, nullable=True))
    op.add_column("alerts", sa.Column("trade_uuid", UUID_TYPE, nullable=True))
    op.add_column("trade_journal", sa.Column("trade_uuid", UUID_TYPE, nullable=True))

    _assign_random_uuid(bind, table="users", pk_column="user_id", uuid_column="user_uuid")
    _assign_random_uuid(bind, table="trades", pk_column="trade_id", uuid_column="trade_uuid")

    for table in ("images", "pattern_results", "alerts", "trade_journal"):
        _fill_child_uuid(bind, table)

    _ensure_constraint(bind, "users", "uq_users_user_uuid", ["user_uuid"])
    _ensure_constraint(bind, "trades", "uq_trades_trade_uuid", ["trade_uuid"])

    op.create_foreign_key(
        "fk_images_trade_uuid",
        "images",
        "trades",
        ["trade_uuid"],
        ["trade_uuid"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_pattern_results_trade_uuid",
        "pattern_results",
        "trades",
        ["trade_uuid"],
        ["trade_uuid"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_alerts_trade_uuid",
        "alerts",
        "trades",
        ["trade_uuid"],
        ["trade_uuid"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_trade_journal_trade_uuid",
        "trade_journal",
        "trades",
        ["trade_uuid"],
        ["trade_uuid"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    raise RuntimeError("Downgrades are unsupported for UUID migration phase A")
