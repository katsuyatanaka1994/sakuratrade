from __future__ import annotations

from datetime import datetime
from uuid import UUID
from enum import Enum

from pydantic import BaseModel, ConfigDict


def to_camel(string: str) -> str:
    parts = string.split('_')
    return parts[0] + ''.join(word.capitalize() for word in parts[1:])


class CamelModel(BaseModel):
    model_config = ConfigDict(from_attributes=True, alias_generator=to_camel, populate_by_name=True)


class Side(str, Enum):
    LONG = "LONG"
    SHORT = "SHORT"


class AlertType(str, Enum):
    TP = "TP"
    SL = "SL"


class RegisterRequest(CamelModel):
    email: str
    password: str


class OAuthRequest(CamelModel):
    provider_token: str


class User(CamelModel):
    user_id: UUID
    email: str
    role: str | None = None
    plan: str | None = None


class Trade(CamelModel):
    trade_id: int
    user_id: UUID
    ticker: str
    side: Side
    price_in: float
    price_out: float | None = None
    size: float
    entered_at: datetime
    exited_at: datetime | None = None


class Image(CamelModel):
    image_id: int
    trade_id: int
    s3_url: str
    thumbnail_url: str | None = None
    uploaded_at: datetime


class PatternResult(CamelModel):
    pattern_id: int
    trade_id: int
    rule: str
    score: float
    advice: str | None = None
    diagnosed_at: datetime


class Alert(CamelModel):
    alert_id: int
    trade_id: int
    type: AlertType
    target_price: float
    triggered_at: datetime | None = None
