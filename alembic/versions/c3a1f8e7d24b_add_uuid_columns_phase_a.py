"""Add UUID companion columns (Phase A)

Revision ID: c3a1f8e7d24b
Revises: 690ffec9e9e7
Create Date: 2025-10-08 11:45:00.000000

"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c3a1f8e7d24b"
down_revision = "690ffec9e9e7"
branch_labels = None
depends_on = None


UUID_LEN = 36


def _add_column(table: str, column: str, *, fk: tuple[str, str] | None = None) -> None:
    op.add_column(table, sa.Column(column, sa.String(length=UUID_LEN), nullable=True))
    if fk:
        op.create_foreign_key(
            f"fk_{table}_{column}",
            table,
            fk[0],
            [column],
            [fk[1]],
        )


def _drop_column(table: str, column: str) -> None:
    try:
        op.drop_constraint(f"fk_{table}_{column}", table, type_="foreignkey")
    except sa.exc.DBAPIError:
        pass
    except sa.exc.OperationalError:
        pass
    op.drop_column(table, column)


def upgrade() -> None:
    _add_column("users", "user_uuid")
    op.create_unique_constraint("uq_users_user_uuid", "users", ["user_uuid"])

    _add_column("trades", "trade_uuid")
    op.create_unique_constraint("uq_trades_trade_uuid", "trades", ["trade_uuid"])

    _add_column("images", "trade_uuid", fk=("trades", "trade_uuid"))
    _add_column("pattern_results", "trade_uuid", fk=("trades", "trade_uuid"))
    _add_column("alerts", "trade_uuid", fk=("trades", "trade_uuid"))
    _add_column("trade_journal", "trade_uuid")
    op.create_unique_constraint("uq_trade_journal_trade_uuid", "trade_journal", ["trade_uuid"])

    bind = op.get_bind()

    # ensure dummy user exists for tests/reference FKs
    zero_uuid = uuid.UUID("00000000-0000-0000-0000-000000000000")
    zero_email = "dummy-tester@gptset.local"

    user_rows = bind.execute(sa.text("SELECT user_id, user_uuid FROM users")).mappings().all()
    for row in user_rows:
        user_id = row["user_id"]
        try:
            parsed = str(uuid.UUID(str(user_id)))
        except Exception:
            parsed = str(uuid.uuid4())
        bind.execute(
            sa.text("UPDATE users SET user_uuid = :uuid WHERE user_id = :user_id"),
            {"uuid": parsed, "user_id": user_id},
        )

    existing_zero = bind.execute(
        sa.text("SELECT 1 FROM users WHERE user_id = :uid"),
        {"uid": str(zero_uuid)},
    ).first()
    if existing_zero is None:
        bind.execute(
            sa.text("INSERT INTO users (user_id, user_uuid, email) VALUES (:uid, :uuid, :email)"),
            {"uid": str(zero_uuid), "uuid": str(zero_uuid), "email": zero_email},
        )

    trade_rows = bind.execute(sa.text("SELECT trade_id, user_id FROM trades")).mappings().all()
    for row in trade_rows:
        trade_uuid = str(uuid.uuid4())
        trade_id = row["trade_id"]
        bind.execute(
            sa.text("UPDATE trades SET trade_uuid = :uuid WHERE trade_id = :tid"),
            {"uuid": trade_uuid, "tid": trade_id},
        )
        bind.execute(
            sa.text("UPDATE images SET trade_uuid = :uuid WHERE trade_id = :tid"),
            {"uuid": trade_uuid, "tid": trade_id},
        )
        bind.execute(
            sa.text("UPDATE pattern_results SET trade_uuid = :uuid WHERE trade_id = :tid"),
            {"uuid": trade_uuid, "tid": trade_id},
        )
        bind.execute(
            sa.text("UPDATE alerts SET trade_uuid = :uuid WHERE trade_id = :tid"),
            {"uuid": trade_uuid, "tid": trade_id},
        )

    journal_rows = bind.execute(sa.text("SELECT trade_id FROM trade_journal")).mappings().all()
    for row in journal_rows:
        trade_uuid = str(uuid.uuid4())
        bind.execute(
            sa.text("UPDATE trade_journal SET trade_uuid = :uuid WHERE trade_id = :tid"),
            {"uuid": trade_uuid, "tid": row["trade_id"]},
        )


def downgrade() -> None:
    try:
        op.drop_constraint("uq_trade_journal_trade_uuid", "trade_journal", type_="unique")
    except sa.exc.DBAPIError:
        pass
    except sa.exc.OperationalError:
        pass
    _drop_column("trade_journal", "trade_uuid")

    _drop_column("alerts", "trade_uuid")
    _drop_column("pattern_results", "trade_uuid")
    _drop_column("images", "trade_uuid")

    op.drop_constraint("uq_trades_trade_uuid", "trades", type_="unique")
    _drop_column("trades", "trade_uuid")

    op.drop_constraint("uq_users_user_uuid", "users", type_="unique")
    _drop_column("users", "user_uuid")
