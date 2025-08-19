from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str | None]
    plan: Mapped[str | None]

    trades: Mapped[list[Trade]] = relationship(back_populates="user")


class Trade(Base):
    __tablename__ = "trades"

    trade_id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.user_id"))
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

    user: Mapped[User] = relationship(back_populates="trades")
    images: Mapped[list[Image]] = relationship(back_populates="trade")
    pattern_result: Mapped[PatternResult] = relationship(back_populates="trade", uselist=False)
    alerts: Mapped[list[Alert]] = relationship(back_populates="trade")


class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[UUID] = mapped_column(ForeignKey("trades.trade_id"))
    s3_url: Mapped[str]
    thumbnail_url: Mapped[str | None]
    uploaded_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(back_populates="images")


class PatternResult(Base):
    __tablename__ = "pattern_results"

    pattern_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[UUID] = mapped_column(ForeignKey("trades.trade_id"))
    rule: Mapped[str]
    score: Mapped[float]
    advice: Mapped[str | None]
    diagnosed_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(back_populates="pattern_result")


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[UUID] = mapped_column(ForeignKey("trades.trade_id"))
    type: Mapped[str]
    target_price: Mapped[float]
    triggered_at: Mapped[datetime | None]

    trade: Mapped[Trade] = relationship(back_populates="alerts")


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    messages_json: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON形式でメッセージを格納
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # ソフトデリート用

    # リレーション（必要に応じて）
    user: Mapped[User | None] = relationship("User", foreign_keys=[user_id])


class TradeJournal(Base):
    __tablename__ = "trade_journal"

    trade_id: Mapped[str] = mapped_column(String, primary_key=True, unique=True)
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
