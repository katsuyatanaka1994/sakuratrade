from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db.types import JSONText, UUIDStr


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[UUID] = mapped_column(UUIDStr(), primary_key=True)
    user_uuid: Mapped[UUID | None] = mapped_column(UUIDStr(), unique=True, default=uuid4, nullable=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str | None]
    plan: Mapped[str | None]

    trades: Mapped[list["Trade"]] = relationship(back_populates="user")


class Trade(Base):
    __tablename__ = "trades"

    trade_id: Mapped[int] = mapped_column(primary_key=True)
    trade_uuid: Mapped[UUID | None] = mapped_column(UUIDStr(), unique=True, default=uuid4, nullable=True)
    user_id: Mapped[UUID] = mapped_column(UUIDStr(), ForeignKey("users.user_id"))
    stock_code: Mapped[str]
    ticker: Mapped[str]
    side: Mapped[str]
    quantity: Mapped[int]
    price_in: Mapped[float]
    entry_price: Mapped[float]
    price_out: Mapped[float | None]
    size: Mapped[float]
    # 入力時刻（entry_at ではなく entered_at が正しいフィールド名）
    entered_at: Mapped[datetime]
    exited_at: Mapped[datetime | None]
    description: Mapped[str]

    user: Mapped[User] = relationship(back_populates="trades", foreign_keys=[user_id])
    images: Mapped[list["Image"]] = relationship(
        "Image",
        back_populates="trade",
        foreign_keys="Image.trade_id",
    )
    pattern_result: Mapped["PatternResult"] = relationship(
        "PatternResult",
        back_populates="trade",
        foreign_keys="PatternResult.trade_id",
        uselist=False,
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert",
        back_populates="trade",
        foreign_keys="Alert.trade_id",
    )


class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    trade_uuid: Mapped[UUID | None] = mapped_column(ForeignKey("trades.trade_uuid"), nullable=True)
    s3_url: Mapped[str]
    thumbnail_url: Mapped[str | None]
    uploaded_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(
        "Trade",
        back_populates="images",
        foreign_keys=[trade_id],
    )


class PatternResult(Base):
    __tablename__ = "pattern_results"

    pattern_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    trade_uuid: Mapped[UUID | None] = mapped_column(ForeignKey("trades.trade_uuid"), nullable=True)
    rule: Mapped[str]
    score: Mapped[float]
    advice: Mapped[str | None]
    diagnosed_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(
        "Trade",
        back_populates="pattern_result",
        foreign_keys=[trade_id],
    )


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    trade_uuid: Mapped[UUID | None] = mapped_column(ForeignKey("trades.trade_uuid"), nullable=True)
    type: Mapped[str]
    target_price: Mapped[float]
    triggered_at: Mapped[datetime | None]

    trade: Mapped[Trade] = relationship(
        "Trade",
        back_populates="alerts",
        foreign_keys=[trade_id],
    )


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(UUIDStr(), ForeignKey("users.user_id"), nullable=True)
    messages_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON形式でメッセージを格納
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # ソフトデリート用

    # リレーション（必要に応じて）
    user: Mapped[User | None] = relationship("User", foreign_keys=[user_id])
    messages: Mapped[list[ChatMessage]] = relationship(back_populates="chat", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    chat_id: Mapped[str] = mapped_column(ForeignKey("chats.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # TEXT, ENTRY, EXIT
    author_id: Mapped[str] = mapped_column(String, nullable=False)

    # Content fields
    text: Mapped[str | None] = mapped_column(Text, nullable=True)  # for TEXT type
    payload: Mapped[dict | None] = mapped_column(JSONText(), nullable=True)  # for ENTRY/EXIT type

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # リレーション
    chat: Mapped[Chat] = relationship(back_populates="messages")


class TradeJournal(Base):
    __tablename__ = "trade_journal"

    trade_id: Mapped[str] = mapped_column(String, primary_key=True, unique=True)
    trade_uuid: Mapped[UUID | None] = mapped_column(UUIDStr(), nullable=True, unique=True)
    user_id: Mapped[str | None] = mapped_column(String, nullable=True)  # For future user system
    chat_id: Mapped[str] = mapped_column(String, nullable=False)
    symbol: Mapped[str] = mapped_column(String, nullable=False)
    side: Mapped[str] = mapped_column(String, nullable=False)  # LONG or SHORT

    # Trade metrics
    avg_entry: Mapped[float] = mapped_column(Float, nullable=False)
    avg_exit: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    pnl_abs: Mapped[float] = mapped_column(Float, nullable=False)
    pnl_pct: Mapped[float] = mapped_column(Float, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)

    # Feedback from chat
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_tone: Mapped[str | None] = mapped_column(String, nullable=True)  # praise or advice
    feedback_next_actions: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string array
    feedback_message_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Analysis data (optional)
    analysis_score: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0-100
    analysis_labels: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string array

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
