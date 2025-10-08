"""historical merge (no-op)

Revision ID: 42efb5df5908
Revises: 075da85ea6f3, c3a1f8e7d24b
Create Date: 2025-10-08 20:20:04.352778

"""

from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = "42efb5df5908"
down_revision: Union[str, Sequence[str], None] = ("075da85ea6f3", "c3a1f8e7d24b")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """No changes required; maintained for historical DAG coherence."""
    pass


def downgrade() -> None:
    """Downgrade is not supported for merge placeholders."""
    pass
