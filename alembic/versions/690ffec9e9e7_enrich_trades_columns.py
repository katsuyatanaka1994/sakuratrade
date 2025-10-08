"""add trade detail columns with idempotent guards

Revision ID: 690ffec9e9e7
Revises: 2f8dbe8b6d6c
Create Date: 2025-07-15 16:08:29.870852

"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "690ffec9e9e7"
down_revision: Union[str, Sequence[str], None] = "2f8dbe8b6d6c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_map(inspector: sa.Inspector, table: str) -> dict[str, sa.Column]:
    return {col["name"]: col for col in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    desired_columns = {
        "stock_code": sa.Column("stock_code", sa.String(length=255), nullable=False),
        "quantity": sa.Column("quantity", sa.Integer(), nullable=False),
        "entry_price": sa.Column("entry_price", sa.Float(), nullable=False),
        "description": sa.Column("description", sa.String(length=1024), nullable=False),
    }

    existing = _column_map(inspector, "trades")

    for name, column in desired_columns.items():
        if name not in existing:
            op.add_column("trades", column.copy())
            bind.execute(
                sa.text(
                    {
                        "stock_code": "UPDATE trades SET stock_code = COALESCE(stock_code, ticker)",
                        "quantity": "UPDATE trades SET quantity = COALESCE(quantity, 0)",
                        "entry_price": "UPDATE trades SET entry_price = COALESCE(entry_price, price_in)",
                        "description": "UPDATE trades SET description = COALESCE(description, '')",
                    }[name]
                )
            )
            op.alter_column("trades", name, nullable=False)
        else:
            if existing[name]["nullable"]:
                bind.execute(
                    sa.text(
                        {
                            "stock_code": "UPDATE trades SET stock_code = COALESCE(stock_code, ticker)",
                            "quantity": "UPDATE trades SET quantity = COALESCE(quantity, 0)",
                            "entry_price": "UPDATE trades SET entry_price = COALESCE(entry_price, price_in)",
                            "description": "UPDATE trades SET description = COALESCE(description, '')",
                        }[name]
                    )
                )
                op.alter_column("trades", name, nullable=False)


def downgrade() -> None:
    try:
        with op.batch_alter_table("trades") as batch_op:
            for name in ["description", "entry_price", "quantity", "stock_code"]:
                try:
                    batch_op.drop_column(name)
                except Exception:  # noqa: BLE001
                    pass
    except Exception:  # noqa: BLE001
        pass
