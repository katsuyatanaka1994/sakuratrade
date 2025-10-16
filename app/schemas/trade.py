# app/schemas/trade.py
from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TradeIn(BaseModel):
    trade_id: Optional[UUID] = Field(default=None, alias="tradeId")
    user_id: UUID = Field(alias="userId")
    ticker: str
    side: str
    price_in: float = Field(alias="priceIn")
    size: float
    entered_at: datetime = Field(alias="enteredAt")
    stock_code: Optional[str] = Field(default=None, alias="stockCode")
    quantity: Optional[int] = Field(default=None, alias="quantity")
    entry_price: Optional[float] = Field(default=None, alias="entryPrice")
    description: Optional[str] = Field(default=None, alias="description")

    model_config = ConfigDict(populate_by_name=True)


class TradeOut(BaseModel):
    trade_id: UUID = Field(validation_alias="trade_uuid", serialization_alias="tradeId")
    user_id: Optional[UUID] = Field(serialization_alias="userId")
    ticker: str
    side: str
    price_in: float = Field(serialization_alias="priceIn")
    size: float
    entered_at: datetime = Field(serialization_alias="enteredAt")
    stock_code: Optional[str] = Field(default=None, serialization_alias="stockCode")
    quantity: Optional[int] = Field(default=None, serialization_alias="quantity")
    entry_price: Optional[float] = Field(default=None, serialization_alias="entryPrice")
    description: Optional[str] = Field(default=None, serialization_alias="description")
    price_out: Optional[float] = Field(default=None, serialization_alias="priceOut")
    exited_at: Optional[datetime] = Field(default=None, serialization_alias="exitedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TradeCreate(BaseModel):
    user_id: UUID
    ticker: str
    side: str
    price_in: float
    size: float
    entered_at: datetime
    stock_code: Optional[str] = None
    quantity: Optional[int] = None
    entry_price: Optional[float] = None
    description: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)
