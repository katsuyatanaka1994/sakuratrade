"""add chat and chat messages tables

Revision ID: 075da85ea6f3
Revises: 690ffec9e9e7
Create Date: 2025-08-28 15:17:19.284145

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "075da85ea6f3"
down_revision: Union[str, Sequence[str], None] = "690ffec9e9e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create chats table
    op.create_table(
        "chats",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("messages_json", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create chat_messages table
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("chat_id", sa.String(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("author_id", sa.String(), nullable=False),
        sa.Column("text", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["chat_id"],
            ["chats.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # Create indexes for performance
    op.create_index("ix_chat_messages_chat_id", "chat_messages", ["chat_id"])
    op.create_index("ix_chat_messages_created_at", "chat_messages", ["created_at"])
    op.create_index("ix_chat_messages_type", "chat_messages", ["type"])
    op.create_index("ix_chat_messages_author_id", "chat_messages", ["author_id"])


def downgrade() -> None:
    """Downgrade schema."""
    # Drop indexes
    op.drop_index("ix_chat_messages_author_id", "chat_messages")
    op.drop_index("ix_chat_messages_type", "chat_messages")
    op.drop_index("ix_chat_messages_created_at", "chat_messages")
    op.drop_index("ix_chat_messages_chat_id", "chat_messages")

    # Drop tables
    op.drop_table("chat_messages")
    op.drop_table("chats")
