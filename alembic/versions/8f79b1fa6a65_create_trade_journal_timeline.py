"""create trade journal timeline table

Revision ID: 8f79b1fa6a65
Revises: 3ee6f2a8b30c
Create Date: 2025-10-07 12:30:00
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "8f79b1fa6a65"
down_revision = "3ee6f2a8b30c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "trade_journal_timeline",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("trade_id", sa.String(), nullable=False),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("occurred_at", sa.DateTime(), nullable=False),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("qty", sa.Integer(), nullable=True),
        sa.Column("realized_pnl", sa.Float(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("raw", sa.Text(), nullable=True),
        sa.Column("message_id", sa.String(), nullable=True),
        sa.Column("image_url", sa.String(), nullable=True),
        sa.Column("thumb_url", sa.String(), nullable=True),
        sa.Column("supersedes_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            server_onupdate=sa.func.now(),
        ),
        sa.ForeignKeyConstraint(["trade_id"], ["trade_journal.trade_id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_trade_journal_timeline_trade_id",
        "trade_journal_timeline",
        ["trade_id", "occurred_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_trade_journal_timeline_trade_id", table_name="trade_journal_timeline")
    op.drop_table("trade_journal_timeline")
