from datetime import datetime
from typing import Optional, Dict, Any, Union, Literal
from pydantic import BaseModel


class EntryPayload(BaseModel):
    symbolCode: str
    symbolName: str
    side: Literal['LONG', 'SHORT']
    price: float
    qty: int
    note: Optional[str] = None
    executedAt: Optional[str] = None
    tradeId: str
    chartPattern: Optional[Literal['pullback-buy', 'retest-short', 'breakout', 'double-bottom', 'trend-follow']] = None


class ExitPayload(BaseModel):
    tradeId: str
    exitPrice: float
    exitQty: int
    note: Optional[str] = None
    executedAt: Optional[str] = None


class ChatMessageBase(BaseModel):
    type: Literal['TEXT', 'ENTRY', 'EXIT']
    author_id: str


class ChatMessageText(ChatMessageBase):
    type: Literal['TEXT']
    text: str


class ChatMessageEntry(ChatMessageBase):
    type: Literal['ENTRY']
    payload: EntryPayload


class ChatMessageExit(ChatMessageBase):
    type: Literal['EXIT']
    payload: ExitPayload


ChatMessageCreate = Union[ChatMessageText, ChatMessageEntry, ChatMessageExit]


class ChatMessageUpdate(BaseModel):
    type: Literal['TEXT', 'ENTRY', 'EXIT']
    text: Optional[str] = None
    content: Optional[str] = None  # Frontend compatibility
    payload: Optional[Union[EntryPayload, ExitPayload]] = None


class ChatMessageResponse(BaseModel):
    id: str
    chat_id: str
    type: Literal['TEXT', 'ENTRY', 'EXIT']
    author_id: str
    text: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
