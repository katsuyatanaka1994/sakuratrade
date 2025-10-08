"""initial trading schema

Revision ID: 2f8dbe8b6d6c
Revises:
Create Date: 2025-07-12 15:17:41.388139

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2f8dbe8b6d6c"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("user_id", sa.BigInteger(), primary_key=True),
        sa.Column("role", sa.String(length=255), nullable=True),
        sa.Column("plan", sa.String(length=255), nullable=True),
    )

    op.create_table(
        "trades",
        sa.Column("trade_id", sa.BigInteger(), primary_key=True),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("ticker", sa.String(length=255), nullable=False),
        sa.Column("side", sa.String(length=32), nullable=False),
        sa.Column("price_in", sa.Float(), nullable=False),
        sa.Column("price_out", sa.Float(), nullable=True),
        sa.Column("size", sa.Float(), nullable=False),
        sa.Column("entered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("exited_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], name="fk_trades_user_id"),
    )
    op.create_index("ix_trades_user_id", "trades", ["user_id"])

    op.create_table(
        "images",
        sa.Column("image_id", sa.BigInteger(), primary_key=True),
        sa.Column("trade_id", sa.BigInteger(), nullable=False),
        sa.Column("s3_url", sa.String(length=1024), nullable=False),
        sa.Column("thumbnail_url", sa.String(length=1024), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.trade_id"], name="fk_images_trade_id"),
    )
    op.create_index("ix_images_trade_id", "images", ["trade_id"])

    op.create_table(
        "pattern_results",
        sa.Column("pattern_id", sa.BigInteger(), primary_key=True),
        sa.Column("trade_id", sa.BigInteger(), nullable=False),
        sa.Column("rule", sa.String(length=255), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("advice", sa.Text(), nullable=True),
        sa.Column("diagnosed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.trade_id"], name="fk_pattern_results_trade_id"),
    )
    op.create_index("ix_pattern_results_trade_id", "pattern_results", ["trade_id"])

    op.create_table(
        "alerts",
        sa.Column("alert_id", sa.BigInteger(), primary_key=True),
        sa.Column("trade_id", sa.BigInteger(), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("target_price", sa.Float(), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.trade_id"], name="fk_alerts_trade_id"),
    )
    op.create_index("ix_alerts_trade_id", "alerts", ["trade_id"])

    op.create_table(
        "trade_journal",
        sa.Column("journal_id", sa.BigInteger(), primary_key=True),
        sa.Column("trade_id", sa.BigInteger(), nullable=False),
        sa.Column("chat_id", sa.String(length=255), nullable=False),
        sa.Column("symbol", sa.String(length=255), nullable=False),
        sa.Column("side", sa.String(length=32), nullable=False),
        sa.Column("avg_entry", sa.Float(), nullable=False),
        sa.Column("avg_exit", sa.Float(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False),
        sa.Column("pnl_abs", sa.Float(), nullable=False),
        sa.Column("pnl_pct", sa.Float(), nullable=False),
        sa.Column("hold_minutes", sa.Integer(), nullable=False),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("feedback_text", sa.Text(), nullable=True),
        sa.Column("feedback_tone", sa.String(length=32), nullable=True),
        sa.Column("feedback_next_actions", sa.JSON(), nullable=True),
        sa.Column("feedback_message_id", sa.String(length=255), nullable=True),
        sa.Column("analysis_score", sa.Integer(), nullable=True),
        sa.Column("analysis_labels", sa.JSON(), nullable=True),
        sa.ForeignKeyConstraint(["trade_id"], ["trades.trade_id"], name="fk_trade_journal_trade_id"),
    )
    op.create_unique_constraint("uq_trade_journal_trade_id", "trade_journal", ["trade_id"])

    op.create_table(
        "chats",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=True),
        sa.Column("messages_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.user_id"], name="fk_chats_user_id"),
    )
    op.create_index("ix_chats_user_id", "chats", ["user_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=255), primary_key=True),
        sa.Column("chat_id", sa.String(length=255), nullable=False),
        sa.Column("type", sa.String(length=32), nullable=False),
        sa.Column("author_id", sa.String(length=255), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["chat_id"], ["chats.id"], name="fk_chat_messages_chat_id"),
    )
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"])
    op.create_index("ix_chat_messages_author_id", "chat_messages", ["author_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    op.create_index("ix_chat_messages_type", "chat_messages", ["type"])


def downgrade() -> None:
    op.drop_index("ix_chat_messages_type", table_name="chat_messages")
    op.drop_index("ix_chat_messages_created_at", table_name="chat_messages")
    op.drop_index("ix_chat_messages_author_id", table_name="chat_messages")
    op.drop_index("ix_chat_messages_chat_id", table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index("ix_chats_user_id", table_name="chats")
    op.drop_table("chats")

    op.drop_constraint("uq_trade_journal_trade_id", "trade_journal", type_="unique")
    op.drop_table("trade_journal")

    op.drop_index("ix_alerts_trade_id", table_name="alerts")
    op.drop_table("alerts")

    op.drop_index("ix_pattern_results_trade_id", table_name="pattern_results")
    op.drop_table("pattern_results")

    op.drop_index("ix_images_trade_id", table_name="images")
    op.drop_table("images")

    op.drop_index("ix_trades_user_id", table_name="trades")
    op.drop_table("trades")

    op.drop_table("users")
