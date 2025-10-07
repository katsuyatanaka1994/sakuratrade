"""create trade journal table if missing

Revision ID: 2459792a0538
Revises: 075da85ea6f3
Create Date: 2025-10-07 18:10:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "2459792a0538"
down_revision: Union[str, Sequence[str], None] = "075da85ea6f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(connection, table_name: str) -> bool:
    inspector = inspect(connection)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    if _table_exists(bind, "trade_journal"):
        return

    op.create_table(
        "trade_journal",
        sa.Column("trade_id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("chat_id", sa.String(), nullable=False),
        sa.Column("symbol", sa.String(), nullable=False),
        sa.Column("side", sa.String(), nullable=False),
        sa.Column("avg_entry", sa.Float(), nullable=False),
        sa.Column("avg_exit", sa.Float(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("pnl_abs", sa.Float(), nullable=False),
        sa.Column("pnl_pct", sa.Float(), nullable=False),
        sa.Column("hold_minutes", sa.Integer(), nullable=False),
        sa.Column("closed_at", sa.DateTime(), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=True),
        sa.Column("feedback_tone", sa.String(), nullable=True),
        sa.Column("feedback_next_actions", sa.Text(), nullable=True),
        sa.Column("feedback_message_id", sa.String(), nullable=True),
        sa.Column("analysis_score", sa.Integer(), nullable=True),
        sa.Column("analysis_labels", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            server_onupdate=sa.func.now(),
        ),
    )


def downgrade() -> None:
    bind = op.get_bind()
    if not _table_exists(bind, "trade_journal"):
        return

    op.drop_table("trade_journal")
