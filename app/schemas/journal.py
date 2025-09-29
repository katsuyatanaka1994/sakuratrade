from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class FeedbackData(BaseModel):
    text: str
    tone: str  # 'praise' or 'advice'
    next_actions: List[str]
    message_id: Optional[str] = None


class AnalysisData(BaseModel):
    score: int  # 0-100
    labels: List[str]  # max 3


class JournalClosePayload(BaseModel):
    trade_id: str
    user_id: Optional[str] = None
    chat_id: str
    symbol: str
    side: str  # 'LONG' or 'SHORT'
    avg_entry: float
    avg_exit: float
    qty: int
    pnl_abs: float
    pnl_pct: float
    hold_minutes: int
    closed_at: str  # ISO datetime string
    feedback: Optional[FeedbackData] = None
    analysis: Optional[AnalysisData] = None


class JournalEntryResponse(BaseModel):
    trade_id: str
    chat_id: str
    symbol: str
    side: str
    avg_entry: float
    avg_exit: float
    qty: int
    pnl_abs: float
    pnl_pct: float
    hold_minutes: int
    closed_at: datetime
    feedback_text: Optional[str]
    feedback_tone: Optional[str]
    feedback_next_actions: Optional[List[str]]
    feedback_message_id: Optional[str]
    analysis_score: Optional[int]
    analysis_labels: Optional[List[str]]
    created_at: datetime
    updated_at: datetime


class JournalListQuery(BaseModel):
    from_date: Optional[str] = None  # ISO date string
    to_date: Optional[str] = None  # ISO date string
    symbol: Optional[str] = None
    pnl: Optional[str] = None  # 'win' or 'lose'
    limit: Optional[int] = 50
    offset: Optional[int] = 0


class FeedbackResponse(BaseModel):
    feedback_text: str
    chat_id: str
    message_id: Optional[str] = None
