
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
    BUY = "buy"
    SELL = "sell"
    LONG = "LONG"
    SHORT = "SHORT"


class Trade(BaseModel):
    trade_id: int
    user_id: UUID
    stock_code: str
    side: Side
    quantity: int
    entry_price: float
    exit_price: Optional[float] = None

    entry_at: datetime
    exit_at: Optional[datetime] = None
    price_in: float
    price_out: Optional[float] = None
    size: float
    entered_at: datetime
    exited_at: Optional[datetime] = None
    description: str 

class Image(BaseModel):
    image_id: int
    trade_id: int
    s3_url: str
    thumbnail_url: Optional[str] = None
    title: str
    uploaded_at: datetime
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


# Login schemas for authentication
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: User


# Registration schema
class RegisterRequest(BaseModel):
    email: str
    password: str


# OAuth request schema
class OAuthRequest(BaseModel):
    provider: str
    token: str
