from typing import List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_session
from app.models import Trade
from app.schemas.trade import TradeCreate, TradeIn, TradeOut

router = APIRouter(prefix="/trades", tags=["trades"])


@router.post("", response_model=TradeOut, status_code=status.HTTP_201_CREATED)
async def create_trade(payload: TradeIn, session: AsyncSession = Depends(get_session)):
    trade_kwargs = {
        "user_id": payload.user_id,
        "ticker": payload.ticker,
        "side": payload.side,
        "price_in": payload.price_in,
        "stock_code": payload.stock_code or payload.ticker,
        "quantity": payload.quantity if payload.quantity is not None else 0,
        "entry_price": payload.entry_price or payload.price_in,
        "size": payload.size,
        "entered_at": payload.entered_at,
        "description": payload.description or "",
    }
    if payload.trade_id:
        trade_kwargs["trade_uuid"] = payload.trade_id

    new_trade = Trade(**trade_kwargs)
    session.add(new_trade)
    await session.flush()
    await session.refresh(new_trade)
    refreshed = await session.get(Trade, new_trade.trade_uuid)
    await session.commit()
    return TradeOut.model_validate(refreshed)


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
        quantity=trade.quantity if trade.quantity is not None else 0,
        entry_price=trade.entry_price or trade.price_in,
        entered_at=trade.entered_at,
        price_in=trade.price_in,
        size=trade.size,
        description=trade.description or "",
    )
    db.add(db_trade)
    db.commit()
    db.refresh(db_trade)
    return TradeOut.model_validate(db_trade)
