from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class Side(str, Enum):
    BUY = "buy"
    SELL = "sell"
    LONG = "LONG"
    SHORT = "SHORT"


class TradeCreate(BaseModel):
    user_id: UUID
    stock_code: str
    ticker: str
    side: Side
    quantity: int
    entry_price: float
    price_in: float
    size: float
    entered_at: datetime
    description: str


class TradeResponse(BaseModel):
    trade_id: int
    user_id: UUID
    stock_code: str
    ticker: str
    side: Side
    quantity: int
    price_in: float
    entry_price: float
    size: float
    entered_at: datetime
    description: str

    model_config = ConfigDict(from_attributes=True)


class User(BaseModel):
    user_id: UUID
    email: str
    role: str | None = None
    plan: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    token: str
    user: User


class RegisterRequest(BaseModel):
    email: str
    password: str


class OAuthRequest(BaseModel):
    provider: str
    token: str


class Image(BaseModel):
    image_id: int
    trade_id: int
    s3_url: str
    thumbnail_url: str | None = None
    uploaded_at: datetime
    title: str
    description: str

    model_config = ConfigDict(from_attributes=True)


class PatternResult(BaseModel):
    pattern_id: int
    trade_id: int
    rule: str
    score: float
    advice: str | None = None
    diagnosed_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertType(str, Enum):
    PRICE = "price"
    VOLUME = "volume"


class Alert(BaseModel):
    alert_id: int
    trade_id: int
    type: AlertType
    target_price: float
    triggered_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
