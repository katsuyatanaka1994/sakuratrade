"""add pattern column to trade journal

Revision ID: 3ee6f2a8b30c
Revises: 2f8dbe8b6d6c
Create Date: 2025-10-07 12:00:00
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "3ee6f2a8b30c"
down_revision = "2459792a0538"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("trade_journal", sa.Column("pattern", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("trade_journal", "pattern")
