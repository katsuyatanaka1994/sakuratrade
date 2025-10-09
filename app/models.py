from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from app.db.types import JSONText


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_uuid: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        unique=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str | None]
    plan: Mapped[str | None]

    trades: Mapped[list["Trade"]] = relationship(back_populates="user")


class Trade(Base):
    __tablename__ = "trades"

    trade_uuid: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        primary_key=True,
        default=uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.user_id"),
        nullable=True,
    )
    stock_code: Mapped[str | None] = mapped_column(String, nullable=True)
    ticker: Mapped[str] = mapped_column(String, nullable=False)
    side: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_in: Mapped[float] = mapped_column(Float, nullable=False)
    entry_price: Mapped[float | None] = mapped_column(Float, nullable=True)
    price_out: Mapped[float | None] = mapped_column(Float, nullable=True)
    size: Mapped[float] = mapped_column(Float, nullable=False)
    entered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    exited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    user: Mapped[User | None] = relationship(back_populates="trades", foreign_keys=[user_id])
    images: Mapped[list["Image"]] = relationship(
        "Image",
        back_populates="trade",
        foreign_keys="Image.trade_uuid",
    )
    pattern_result: Mapped["PatternResult"] = relationship(
        "PatternResult",
        back_populates="trade",
        foreign_keys="PatternResult.trade_uuid",
        uselist=False,
    )
    alerts: Mapped[list["Alert"]] = relationship(
        "Alert",
        back_populates="trade",
        foreign_keys="Alert.trade_uuid",
    )


class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[int] = mapped_column(primary_key=True)
    trade_uuid: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("trades.trade_uuid"), nullable=True
    )
    s3_url: Mapped[str] = mapped_column(String, nullable=False)
    thumbnail_url: Mapped[str | None] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    trade: Mapped[Trade | None] = relationship(
        "Trade",
        back_populates="images",
        foreign_keys=[trade_uuid],
    )


class PatternResult(Base):
    __tablename__ = "pattern_results"

    pattern_id: Mapped[int] = mapped_column(primary_key=True)
    trade_uuid: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("trades.trade_uuid"), nullable=True
    )
    rule: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    advice: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    trade: Mapped[Trade | None] = relationship(
        "Trade",
        back_populates="pattern_result",
        foreign_keys=[trade_uuid],
    )


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(primary_key=True)
    trade_uuid: Mapped[UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("trades.trade_uuid"), nullable=True
    )
    type: Mapped[str] = mapped_column(String, nullable=False)
    target_price: Mapped[float] = mapped_column(Float, nullable=False)
    triggered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    trade: Mapped[Trade | None] = relationship(
        "Trade",
        back_populates="alerts",
        foreign_keys=[trade_uuid],
    )


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    messages_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

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

    journal_id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    trade_uuid: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), ForeignKey("trades.trade_uuid"), unique=True)
    user_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), ForeignKey("users.user_id"), nullable=True)
    chat_id: Mapped[str] = mapped_column(String, nullable=False)
    symbol: Mapped[str] = mapped_column(String, nullable=False)
    side: Mapped[str] = mapped_column(String, nullable=False)

    # Trade metrics
    avg_entry: Mapped[float] = mapped_column(Float, nullable=False)
    avg_exit: Mapped[float] = mapped_column(Float, nullable=False)
    qty: Mapped[int] = mapped_column(Integer, nullable=False)
    pnl_abs: Mapped[float] = mapped_column(Float, nullable=False)
    pnl_pct: Mapped[float] = mapped_column(Float, nullable=False)
    hold_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Feedback from chat
    feedback_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_tone: Mapped[str | None] = mapped_column(String, nullable=True)
    feedback_next_actions: Mapped[str | None] = mapped_column(Text, nullable=True)
    feedback_message_id: Mapped[str | None] = mapped_column(String, nullable=True)

    # Analysis data (optional)
    analysis_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    analysis_labels: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow
    )
