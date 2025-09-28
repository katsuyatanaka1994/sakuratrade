# app/schemas/trade.py
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class TradeCreate(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    price: float
    quantity: int
    timestamp: Optional[datetime] = None
