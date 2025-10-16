from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class FeedbackData(BaseModel):
    text: str
    tone: str  # 'praise' or 'advice'
    next_actions: List[str]
    message_id: Optional[str] = None


class AnalysisData(BaseModel):
    score: int  # 0-100
    labels: List[str]  # max 3


class JournalClosePayload(BaseModel):
    trade_id: UUID = Field(alias="tradeId")
    user_id: Optional[UUID] = Field(default=None, alias="userId")
    chat_id: str = Field(alias="chatId")
    symbol: str
    side: str  # 'LONG' or 'SHORT'
    avg_entry: float = Field(alias="avgEntry")
    avg_exit: float = Field(alias="avgExit")
    qty: int
    pnl_abs: float = Field(alias="pnlAbs")
    pnl_pct: float = Field(alias="pnlPct")
    hold_minutes: int = Field(alias="holdMinutes")
    closed_at: str = Field(alias="closedAt")  # ISO datetime string
    feedback: Optional[FeedbackData] = None
    analysis: Optional[AnalysisData] = None

    model_config = ConfigDict(populate_by_name=True)


class JournalEntryResponse(BaseModel):
    trade_id: UUID = Field(serialization_alias="tradeId")
    chat_id: str = Field(serialization_alias="chatId")
    symbol: str
    side: str
    avg_entry: float = Field(serialization_alias="avgEntry")
    avg_exit: float = Field(serialization_alias="avgExit")
    qty: int
    pnl_abs: float = Field(serialization_alias="pnlAbs")
    pnl_pct: float = Field(serialization_alias="pnlPct")
    hold_minutes: int = Field(serialization_alias="holdMinutes")
    closed_at: datetime = Field(serialization_alias="closedAt")
    feedback_text: Optional[str] = Field(default=None, serialization_alias="feedbackText")
    feedback_tone: Optional[str] = Field(default=None, serialization_alias="feedbackTone")
    feedback_next_actions: Optional[List[str]] = Field(default=None, serialization_alias="feedbackNextActions")
    feedback_message_id: Optional[str] = Field(default=None, serialization_alias="feedbackMessageId")
    analysis_score: Optional[int] = Field(default=None, serialization_alias="analysisScore")
    analysis_labels: Optional[List[str]] = Field(default=None, serialization_alias="analysisLabels")
    created_at: datetime = Field(serialization_alias="createdAt")
    updated_at: datetime = Field(serialization_alias="updatedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


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
