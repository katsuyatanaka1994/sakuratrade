from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter(prefix="/trades", tags=["trades"])

class TradeIn(BaseModel):
    tradeId: Optional[int] = None
    ticker: str
    userId: str
    side: str
    priceIn: float
    size: float
    enteredAt: datetime

class TradeOut(TradeIn):
    tradeId: str

@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
async def create_trade(payload: TradeIn):
    """MVP 用スタブ実装 — tradeId が重複しないよう上書き／生成して返す。"""
    data = payload.model_dump()
# ① tradeId が来ていれば str 型に変換、無ければ UUID を発行
    data["tradeId"] = str(data.get("tradeId") or uuid.uuid4())
    return TradeOut(**data)
