from __future__ import annotations
from datetime import datetime
from uuid import UUID
from enum import Enum
from typing import Optional, List
from pydantic import BaseModel

class User(BaseModel):
    user_id: UUID
    email: str
    role: Optional[str] = None
    plan: Optional[str] = None

class Side(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"

class Trade(BaseModel):
    trade_id: int
    user_id: UUID
    ticker: str
    side: Side
    price_in: float
    price_out: Optional[float] = None
    size: float
    entered_at: datetime
    exited_at: Optional[datetime] = None

class Image(BaseModel):
    image_id: int
    trade_id: int
    s3_url: str
    thumbnail_url: Optional[str] = None
    uploaded_at: datetime
    title: str
    description: str

class PatternResult(BaseModel):
    pattern_id: int
    trade_id: int
    rule: str
    score: float
    advice: Optional[str] = None
    diagnosed_at: datetime

class AlertType(str, Enum):
    PRICE = "price"
    VOLUME = "volume"

class Alert(BaseModel):
    alert_id: int
    trade_id: int
    type: AlertType
    target_price: Optional[float] = None
    triggered_at: Optional[datetime] = None
