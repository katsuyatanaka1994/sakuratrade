from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class JournalListSortOptions(str, Enum):
    """Allowed sort field identifiers for journal list queries."""

    CLOSED_AT_DESC = "closed_at_desc"
    CLOSED_AT_ASC = "closed_at_asc"
    UPDATED_AT_DESC = "updated_at_desc"
    UPDATED_AT_ASC = "updated_at_asc"
    PNL_DESC = "pnl_desc"
    PNL_ASC = "pnl_asc"
    PNL_PCT_DESC = "pnl_pct_desc"
    PNL_PCT_ASC = "pnl_pct_asc"
    AI_SCORE_DESC = "ai_score_desc"
    AI_SCORE_ASC = "ai_score_asc"
    SYMBOL_ASC = "symbol_asc"
    SYMBOL_DESC = "symbol_desc"


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
    pattern: Optional[str] = None
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
    pattern: Optional[str] = None
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
    side: Optional[str] = None  # LONG or SHORT or lowercase variants
    pattern: Optional[str] = None
    pnl: Optional[str] = None  # 'win' or 'lose'
    limit: Optional[int] = 50
    offset: Optional[int] = 0
    sort: Optional[List[JournalListSortOptions]] = Field(default=None, description="List of sort directives")


class JournalListResponse(BaseModel):
    entries: List[JournalEntryResponse]
    total: int
    page: int
    per_page: int


class FeedbackResponse(BaseModel):
    feedback_text: str
    chat_id: str
    message_id: Optional[str] = None


class JournalDetailHeader(BaseModel):
    trade_id: str
    symbol: str
    company_name: Optional[str] = None
    side: str
    pattern: Optional[str] = None
    closed_at: Optional[datetime] = None
    pnl_abs: float
    pnl_pct: Optional[float] = None
    hold_minutes: Optional[int] = None


class JournalPlan(BaseModel):
    tp: Optional[float] = None
    sl: Optional[float] = None
    target: Optional[float] = None
    rr: Optional[float] = None
    expected_pnl: Optional[float] = None


class JournalTimelineItem(BaseModel):
    id: str
    kind: str
    occurred_at: datetime
    price: Optional[float] = None
    qty: Optional[int] = None
    realized_pnl: Optional[float] = None
    note: Optional[str] = None
    raw: Optional[str] = None
    message_id: Optional[str] = None
    image_url: Optional[str] = None
    thumb_url: Optional[str] = None
    supersedes: Optional[str] = None


class JournalMemoItem(BaseModel):
    id: str
    occurred_at: datetime
    note: str
    supersedes: Optional[str] = None


class JournalImageItem(BaseModel):
    id: str
    occurred_at: datetime
    image_url: str
    thumb_url: Optional[str] = None
    note: Optional[str] = None


class JournalAiFeedback(BaseModel):
    positives: List[str] = Field(default_factory=list)
    improvements: List[str] = Field(default_factory=list)
    next_actions: List[str] = Field(default_factory=list)
    raw: Optional[str] = None


class JournalDetailResponse(BaseModel):
    header: JournalDetailHeader
    plan: Optional[JournalPlan] = None
    timeline: List[JournalTimelineItem] = Field(default_factory=list)
    memos: List[JournalMemoItem] = Field(default_factory=list)
    images: List[JournalImageItem] = Field(default_factory=list)
    ai_feedback: Optional[JournalAiFeedback] = None


class JournalImageAttachRequest(BaseModel):
    image_url: str
    thumb_url: Optional[str] = None
    occurred_at: Optional[datetime] = None
    note: Optional[str] = None
    message_id: Optional[str] = None


class JournalMemoCreateRequest(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)
    occurred_at: Optional[datetime] = None
    supersedes: Optional[str] = None
