"""historical chat artifacts (no-op)

Revision ID: 075da85ea6f3
Revises: 690ffec9e9e7
Create Date: 2025-08-28 15:17:19.284145

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "075da85ea6f3"
down_revision: Union[str, Sequence[str], None] = "690ffec9e9e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Schema already provisioned in base revision; this migration intentionally left blank."""
    pass


def downgrade() -> None:
    """No-op downgrade; base revision owns the tables."""
    pass
