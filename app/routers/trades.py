import uuid
from datetime import datetime
from typing import List, Optional, Union
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_session
from app.models import Trade
from app.schemas.trade import TradeCreate

router = APIRouter(prefix="/trades", tags=["trades"])


class TradeIn(BaseModel):
    tradeId: Optional[int] = None
    ticker: str
    userId: str
    side: str
    priceIn: float
    size: float
    enteredAt: datetime


class TradeOut(BaseModel):
    tradeId: Union[int, UUID] = Field(..., alias="trade_id")
    ticker: str
    userId: UUID = Field(..., alias="user_id")
    side: str
    priceIn: float = Field(..., alias="price_in")
    size: float
    enteredAt: datetime = Field(..., alias="entered_at")
    stock_code: Optional[str] = None

    class Config:
        from_attributes = True
        populate_by_name = True


@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
async def create_trade(payload: TradeIn, session: AsyncSession = Depends(get_session)):
    new_trade = Trade(
        trade_id=uuid.uuid4(),
        user_id=UUID(payload.userId),
        ticker=payload.ticker,
        side=payload.side,
        price_in=payload.priceIn,
        size=payload.size,
        entered_at=payload.enteredAt,
    )
    session.add(new_trade)
    await session.commit()
    await session.refresh(new_trade)
    return TradeOut.model_validate(new_trade)


@router.get("", response_model=List[TradeOut])
async def get_trades(session: AsyncSession = Depends(get_session)):
    stmt = select(Trade)
    result = await session.execute(stmt)
    trades = result.scalars().all()
    return trades


@router.post("/save", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
def save_trade(trade: TradeCreate, db: Session = Depends(get_db)):
    db_trade = Trade(
        user_id=trade.user_id,
        stock_code=trade.stock_code,
        ticker=trade.ticker,
        side=trade.side,
        quantity=trade.quantity,
        entry_price=trade.entry_price,
        entered_at=trade.entered_at,
        price_in=trade.price_in,
        size=trade.size,
        description=trade.description,
    )
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return TradeOut.model_validate(db_trade)
