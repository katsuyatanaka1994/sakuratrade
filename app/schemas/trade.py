# app/schemas/trade.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TradeCreate(BaseModel):
    symbol: str
    side: str  # "buy" or "sell"
    price: float
    quantity: int
    timestamp: Optional[datetime] = None