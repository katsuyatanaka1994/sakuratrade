import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.models import TradeJournal
from app.schemas.journal import FeedbackResponse, JournalClosePayload, JournalEntryResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/journal", tags=["journal"])


@router.post("/close")
async def close_trade(payload: JournalClosePayload, db: AsyncSession = Depends(get_async_db)):
    """Idempotent upsert for trade close - creates or updates journal entry"""
    try:
        # Parse closed_at string to datetime (convert to UTC and remove timezone info)
        closed_at = datetime.fromisoformat(payload.closed_at.replace("Z", "+00:00"))
        if closed_at.tzinfo is not None:
            closed_at = closed_at.utctimetuple()
            closed_at = datetime(*closed_at[:6])

        # Prepare data for upsert
        trade_data = {
            "trade_id": payload.trade_id,
            "user_id": payload.user_id,
            "chat_id": payload.chat_id,
            "symbol": payload.symbol,
            "side": payload.side,
            "avg_entry": payload.avg_entry,
            "avg_exit": payload.avg_exit,
            "qty": payload.qty,
            "pnl_abs": payload.pnl_abs,
            "pnl_pct": payload.pnl_pct,
            "hold_minutes": payload.hold_minutes,
            "closed_at": closed_at,
        }

        # Add feedback if provided
        if payload.feedback:
            trade_data.update(
                {
                    "feedback_text": payload.feedback.text,
                    "feedback_tone": payload.feedback.tone,
                    "feedback_next_actions": json.dumps(payload.feedback.next_actions),
                    "feedback_message_id": payload.feedback.message_id,
                }
            )

        # Add analysis if provided
        if payload.analysis:
            trade_data.update(
                {
                    "analysis_score": payload.analysis.score,
                    "analysis_labels": json.dumps(payload.analysis.labels),
                }
            )

        # Use SQLite-style UPSERT (INSERT OR REPLACE)
        # First check if entry exists
        existing_query = select(TradeJournal).where(TradeJournal.trade_id == payload.trade_id)
        existing_result = await db.execute(existing_query)
        existing_entry = existing_result.scalar_one_or_none()

        if existing_entry:
            # Update existing entry, preserving non-null feedback/analysis
            update_data = {
                "avg_entry": payload.avg_entry,
                "avg_exit": payload.avg_exit,
                "qty": payload.qty,
                "pnl_abs": payload.pnl_abs,
                "pnl_pct": payload.pnl_pct,
                "hold_minutes": payload.hold_minutes,
                "closed_at": closed_at,
            }

            # Update feedback only if provided
            if payload.feedback:
                update_data.update(
                    {
                        "feedback_text": payload.feedback.text,
                        "feedback_tone": payload.feedback.tone,
                        "feedback_next_actions": json.dumps(payload.feedback.next_actions),
                        "feedback_message_id": payload.feedback.message_id,
                    }
                )

            # Update analysis only if provided
            if payload.analysis:
                update_data.update(
                    {
                        "analysis_score": payload.analysis.score,
                        "analysis_labels": json.dumps(payload.analysis.labels),
                    }
                )

            for key, value in update_data.items():
                setattr(existing_entry, key, value)
        else:
            # Create new entry
            new_entry = TradeJournal(**trade_data)
            db.add(new_entry)

        # Commit is done below
        await db.commit()

        logger.info(f"Trade journal entry upserted: {payload.trade_id}")

        return {"status": "success", "trade_id": payload.trade_id}

    except Exception as e:
        await db.rollback()
        logger.error(f"Error upserting journal entry {payload.trade_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save journal entry: {str(e)}")


@router.get("/", response_model=List[JournalEntryResponse])
async def get_journal_entries(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    pnl: Optional[str] = Query(None, pattern=r"^(win|lose)$"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_async_db),
):
    """Get journal entries with optional filters"""
    try:
        query = select(TradeJournal)

        # Build filters
        filters = []

        if from_date:
            from_dt = datetime.fromisoformat(from_date)
            filters.append(TradeJournal.closed_at >= from_dt)

        if to_date:
            to_dt = datetime.fromisoformat(to_date)
            filters.append(TradeJournal.closed_at <= to_dt)

        if symbol:
            filters.append(TradeJournal.symbol.ilike(f"%{symbol}%"))

        if pnl == "win":
            filters.append(TradeJournal.pnl_abs > 0)
        elif pnl == "lose":
            filters.append(TradeJournal.pnl_abs <= 0)

        if filters:
            query = query.where(and_(*filters))

        # Order by closed_at DESC (newest first)
        query = query.order_by(TradeJournal.closed_at.desc())

        # Apply pagination
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        entries = result.scalars().all()

        # Convert to response format
        response_entries = []
        for entry in entries:
            response_entries.append(
                JournalEntryResponse(
                    trade_id=entry.trade_id,
                    chat_id=entry.chat_id,
                    symbol=entry.symbol,
                    side=entry.side,
                    avg_entry=entry.avg_entry,
                    avg_exit=entry.avg_exit,
                    qty=entry.qty,
                    pnl_abs=entry.pnl_abs,
                    pnl_pct=entry.pnl_pct,
                    hold_minutes=entry.hold_minutes,
                    closed_at=entry.closed_at,
                    feedback_text=entry.feedback_text,
                    feedback_tone=entry.feedback_tone,
                    feedback_next_actions=json.loads(entry.feedback_next_actions)
                    if entry.feedback_next_actions
                    else None,
                    feedback_message_id=entry.feedback_message_id,
                    analysis_score=entry.analysis_score,
                    analysis_labels=json.loads(entry.analysis_labels) if entry.analysis_labels else None,
                    created_at=entry.created_at,
                    updated_at=entry.updated_at,
                )
            )

        return response_entries

    except Exception as e:
        logger.error(f"Error fetching journal entries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal entries: {str(e)}")


@router.get("/{trade_id}/feedback", response_model=FeedbackResponse)
async def get_trade_feedback(trade_id: str, db: AsyncSession = Depends(get_async_db)):
    """Get feedback text for specific trade (for modal display)"""
    try:
        query = select(TradeJournal).where(TradeJournal.trade_id == trade_id)
        result = await db.execute(query)
        entry = result.scalar_one_or_none()

        if not entry:
            raise HTTPException(status_code=404, detail="Trade not found")

        if not entry.feedback_text:
            raise HTTPException(status_code=404, detail="No feedback found for this trade")

        return FeedbackResponse(
            feedback_text=entry.feedback_text, chat_id=entry.chat_id, message_id=entry.feedback_message_id
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching trade feedback {trade_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch feedback: {str(e)}")
