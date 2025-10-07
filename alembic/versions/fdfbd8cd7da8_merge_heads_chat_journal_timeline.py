"""merge heads: chat + journal timeline

Revision ID: fdfbd8cd7da8
Revises: 8f79b1fa6a65, 075da85ea6f3
Create Date: 2025-10-07 17:41:57.687654

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "fdfbd8cd7da8"
down_revision: Union[str, Sequence[str], None] = "8f79b1fa6a65"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
