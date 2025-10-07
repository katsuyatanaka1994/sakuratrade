import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.models import TradeJournal, TradeJournalTimeline
from app.schemas.journal import (
    FeedbackResponse,
    JournalAiFeedback,
    JournalClosePayload,
    JournalDetailHeader,
    JournalDetailResponse,
    JournalEntryResponse,
    JournalImageAttachRequest,
    JournalImageItem,
    JournalListResponse,
    JournalListSortOptions,
    JournalMemoCreateRequest,
    JournalMemoItem,
    JournalTimelineItem,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/journal", tags=["journal"])


DEFAULT_SORT_ORDER = [
    TradeJournal.closed_at.desc(),
    TradeJournal.updated_at.desc(),
    TradeJournal.trade_id.desc(),
]


SORT_TOKEN_MAP = {
    JournalListSortOptions.CLOSED_AT_DESC.value: [TradeJournal.closed_at.desc()],
    JournalListSortOptions.CLOSED_AT_ASC.value: [TradeJournal.closed_at.asc()],
    JournalListSortOptions.UPDATED_AT_DESC.value: [TradeJournal.updated_at.desc()],
    JournalListSortOptions.UPDATED_AT_ASC.value: [TradeJournal.updated_at.asc()],
    JournalListSortOptions.PNL_DESC.value: [TradeJournal.pnl_abs.desc()],
    JournalListSortOptions.PNL_ASC.value: [TradeJournal.pnl_abs.asc()],
    JournalListSortOptions.PNL_PCT_DESC.value: [TradeJournal.pnl_pct.desc()],
    JournalListSortOptions.PNL_PCT_ASC.value: [TradeJournal.pnl_pct.asc()],
    JournalListSortOptions.AI_SCORE_DESC.value: [TradeJournal.analysis_score.desc()],
    JournalListSortOptions.AI_SCORE_ASC.value: [TradeJournal.analysis_score.asc()],
    JournalListSortOptions.SYMBOL_ASC.value: [TradeJournal.symbol.asc()],
    JournalListSortOptions.SYMBOL_DESC.value: [TradeJournal.symbol.desc()],
}


def _resolve_sort(sort_tokens: Optional[str]) -> List:
    """Translate sort query tokens into SQLAlchemy order by expressions."""

    if not sort_tokens:
        return list(DEFAULT_SORT_ORDER)

    requested_order: List = []
    for raw_token in sort_tokens.split(","):
        token = raw_token.strip()
        if not token:
            continue
        if token not in SORT_TOKEN_MAP:
            raise HTTPException(status_code=400, detail="INVALID_SORT")
        requested_order.extend(SORT_TOKEN_MAP[token])

    if not requested_order:
        return list(DEFAULT_SORT_ORDER)

    # Ensure deterministic ordering by appending trade_id DESC if not already specified
    requested_order.append(TradeJournal.trade_id.desc())
    return requested_order


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
            "pattern": payload.pattern,
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

            if payload.pattern is not None:
                update_data["pattern"] = payload.pattern

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


@router.get("/", response_model=JournalListResponse)
async def get_journal_entries(
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    symbol: Optional[str] = Query(None),
    side: Optional[str] = Query(None, description="Filter by LONG or SHORT"),
    pattern: Optional[str] = Query(None, description="Filter by chart pattern code"),
    pnl: Optional[str] = Query(None, pattern=r"^(win|lose)$"),
    sort: Optional[str] = Query(None, description="Comma separated sort directives"),
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

        if side:
            canonical_side = side.upper()
            if canonical_side not in {"LONG", "SHORT"}:
                raise HTTPException(status_code=400, detail="INVALID_SIDE")
            filters.append(TradeJournal.side == canonical_side)

        if pattern:
            pattern_column = getattr(TradeJournal, "pattern", None)
            if pattern_column is None:
                logger.warning("Pattern filter requested but TradeJournal.pattern column is missing")
            else:
                filters.append(pattern_column == pattern)

        if pnl == "win":
            filters.append(TradeJournal.pnl_abs > 0)
        elif pnl == "lose":
            filters.append(TradeJournal.pnl_abs <= 0)

        if filters:
            query = query.where(and_(*filters))

        order_expressions = _resolve_sort(sort)
        query = query.order_by(*order_expressions)

        # Apply pagination
        query = query.offset(offset).limit(limit)

        result = await db.execute(query)
        entries = result.scalars().all()

        count_query = select(func.count()).select_from(TradeJournal)
        if filters:
            count_query = count_query.where(and_(*filters))

        total_result = await db.execute(count_query)
        total = total_result.scalar_one()

        per_page = limit
        page = offset // per_page + 1

        # Convert to response format
        response_entries = []
        for entry in entries:
            response_entries.append(
                JournalEntryResponse(
                    trade_id=entry.trade_id,
                    chat_id=entry.chat_id,
                    symbol=entry.symbol,
                    side=entry.side,
                    pattern=getattr(entry, "pattern", None),
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

        return JournalListResponse(
            entries=response_entries,
            total=total,
            page=page,
            per_page=per_page,
        )

    except Exception as e:
        logger.error(f"Error fetching journal entries: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal entries: {str(e)}")


@router.get("/{trade_id}", response_model=JournalDetailResponse)
async def get_journal_detail(trade_id: str, db: AsyncSession = Depends(get_async_db)):
    """Return rich journal detail for the trade records page."""

    try:
        query = select(TradeJournal).where(TradeJournal.trade_id == trade_id)
        result = await db.execute(query)
        entry = result.scalar_one_or_none()

        if not entry:
            raise HTTPException(status_code=404, detail="Trade not found")

        pattern_value = getattr(entry, "pattern", None)

        header = JournalDetailHeader(
            trade_id=entry.trade_id,
            symbol=entry.symbol,
            company_name=None,
            side=entry.side,
            pattern=pattern_value,
            closed_at=entry.closed_at,
            pnl_abs=entry.pnl_abs,
            pnl_pct=entry.pnl_pct,
            hold_minutes=entry.hold_minutes,
        )

        timeline_query = (
            select(TradeJournalTimeline)
            .where(TradeJournalTimeline.trade_id == trade_id)
            .order_by(TradeJournalTimeline.occurred_at.asc(), TradeJournalTimeline.created_at.asc())
        )
        timeline_result = await db.execute(timeline_query)
        timeline_rows = timeline_result.scalars().all()

        timeline: List[JournalTimelineItem] = [
            JournalTimelineItem(
                id=item.id,
                kind=item.kind,
                occurred_at=item.occurred_at,
                price=item.price,
                qty=item.qty,
                realized_pnl=item.realized_pnl,
                note=item.note,
                raw=item.raw,
                message_id=item.message_id,
                image_url=item.image_url,
                thumb_url=item.thumb_url,
                supersedes=item.supersedes_id,
            )
            for item in timeline_rows
        ]

        kinds_present = {entry.kind.upper() for entry in timeline}

        entry_timestamp = None
        if entry.closed_at and entry.hold_minutes is not None:
            try:
                entry_timestamp = entry.closed_at - timedelta(minutes=entry.hold_minutes)
            except OverflowError:
                entry_timestamp = entry.closed_at
        else:
            entry_timestamp = entry.closed_at

        if "ENTRY" not in kinds_present and entry_timestamp is not None:
            timeline.insert(
                0,
                JournalTimelineItem(
                    id=f"{entry.trade_id}-entry-generated",
                    kind="ENTRY",
                    occurred_at=entry_timestamp,
                    price=entry.avg_entry,
                    qty=entry.qty,
                    note="記録データから自動生成された建値情報",
                ),
            )

        if "EXIT" not in kinds_present and entry.closed_at is not None:
            timeline.append(
                JournalTimelineItem(
                    id=f"{entry.trade_id}-exit-generated",
                    kind="EXIT",
                    occurred_at=entry.closed_at,
                    price=entry.avg_exit,
                    qty=entry.qty,
                    realized_pnl=entry.pnl_abs,
                    note="記録データから自動生成された決済情報",
                )
            )

        feedback_actions = []
        if entry.feedback_next_actions:
            try:
                feedback_actions = json.loads(entry.feedback_next_actions)
            except json.JSONDecodeError:
                logger.warning("Failed to decode feedback_next_actions for %s", entry.trade_id)

        ai_feedback: Optional[JournalAiFeedback] = None
        if entry.feedback_text or feedback_actions:
            positives: List[str] = []
            improvements: List[str] = []

            if entry.feedback_text:
                if entry.feedback_tone == "praise":
                    positives.append(entry.feedback_text)
                elif entry.feedback_tone == "advice":
                    improvements.append(entry.feedback_text)
                else:
                    improvements.append(entry.feedback_text)

            ai_feedback = JournalAiFeedback(
                positives=positives,
                improvements=improvements,
                next_actions=feedback_actions,
                raw=entry.feedback_text,
            )

        detail = JournalDetailResponse(
            header=header,
            plan=None,
            timeline=timeline,
            memos=[
                JournalMemoItem(
                    id=item.id,
                    occurred_at=item.occurred_at,
                    note=item.note or "",
                    supersedes=item.supersedes_id,
                )
                for item in timeline_rows
                if item.kind.upper() == "MEMO"
            ],
            images=[
                JournalImageItem(
                    id=item.id,
                    occurred_at=item.occurred_at,
                    image_url=item.image_url or "",
                    thumb_url=item.thumb_url,
                    note=item.note,
                )
                for item in timeline_rows
                if item.kind.upper() == "IMAGE" and item.image_url
            ],
            ai_feedback=ai_feedback,
        )

        return detail

    except HTTPException:
        raise
    except Exception as error:
        logger.error("Error fetching journal detail %s: %s", trade_id, str(error))
        raise HTTPException(status_code=500, detail=f"Failed to fetch journal detail: {error}")


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


@router.post(
    "/{trade_id}/images:attach",
    response_model=JournalTimelineItem,
    status_code=status.HTTP_201_CREATED,
)
async def attach_trade_image(
    trade_id: str,
    payload: JournalImageAttachRequest,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        trade_query = select(TradeJournal).where(TradeJournal.trade_id == trade_id)
        trade_result = await db.execute(trade_query)
        trade = trade_result.scalar_one_or_none()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")

        if not payload.image_url:
            raise HTTPException(status_code=400, detail="IMAGE_URL_REQUIRED")

        timeline_entry = TradeJournalTimeline(
            id=str(uuid4()),
            trade_id=trade_id,
            kind="IMAGE",
            occurred_at=payload.occurred_at or datetime.utcnow(),
            price=None,
            qty=None,
            realized_pnl=None,
            note=payload.note,
            raw=None,
            message_id=payload.message_id,
            image_url=payload.image_url,
            thumb_url=payload.thumb_url,
            supersedes_id=None,
        )

        db.add(timeline_entry)
        await db.commit()
        await db.refresh(timeline_entry)

        return JournalTimelineItem(
            id=timeline_entry.id,
            kind=timeline_entry.kind,
            occurred_at=timeline_entry.occurred_at,
            price=None,
            qty=None,
            realized_pnl=None,
            note=timeline_entry.note,
            raw=None,
            message_id=timeline_entry.message_id,
            image_url=timeline_entry.image_url,
            thumb_url=timeline_entry.thumb_url,
            supersedes=None,
        )

    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        await db.rollback()
        logger.error("Error attaching image for %s: %s", trade_id, str(error))
        raise HTTPException(status_code=500, detail=f"Failed to attach image: {error}")


@router.post(
    "/{trade_id}/memos",
    response_model=JournalMemoItem,
    status_code=status.HTTP_201_CREATED,
)
async def create_trade_memo(
    trade_id: str,
    payload: JournalMemoCreateRequest,
    db: AsyncSession = Depends(get_async_db),
):
    try:
        trade_query = select(TradeJournal).where(TradeJournal.trade_id == trade_id)
        trade_result = await db.execute(trade_query)
        trade = trade_result.scalar_one_or_none()
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")

        supersedes_id = payload.supersedes
        if supersedes_id:
            supersedes_query = select(TradeJournalTimeline).where(
                TradeJournalTimeline.trade_id == trade_id,
                TradeJournalTimeline.id == supersedes_id,
            )
            supersedes_result = await db.execute(supersedes_query)
            if supersedes_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=400, detail="SUPPORT_ENTRY_NOT_FOUND")

        timeline_entry = TradeJournalTimeline(
            id=str(uuid4()),
            trade_id=trade_id,
            kind="MEMO",
            occurred_at=payload.occurred_at or datetime.utcnow(),
            note=payload.note,
            price=None,
            qty=None,
            realized_pnl=None,
            raw=None,
            message_id=None,
            image_url=None,
            thumb_url=None,
            supersedes_id=supersedes_id,
        )

        db.add(timeline_entry)
        await db.commit()
        await db.refresh(timeline_entry)

        return JournalMemoItem(
            id=timeline_entry.id,
            occurred_at=timeline_entry.occurred_at,
            note=timeline_entry.note or "",
            supersedes=timeline_entry.supersedes_id,
        )

    except HTTPException:
        raise
    except Exception as error:  # noqa: BLE001
        await db.rollback()
        logger.error("Error creating memo for %s: %s", trade_id, str(error))
        raise HTTPException(status_code=500, detail=f"Failed to create memo: {error}")
