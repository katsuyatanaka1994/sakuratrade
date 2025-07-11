from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import String, Integer, Float, DateTime, ForeignKey
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
    ticker: Mapped[str]
    side: Mapped[str]
    price_in: Mapped[float]
    price_out: Mapped[float | None]
    size: Mapped[float]
    entered_at: Mapped[datetime]
    exited_at: Mapped[datetime | None]

    user: Mapped[User] = relationship(back_populates="trades")
    images: Mapped[list[Image]] = relationship(back_populates="trade")
    pattern_result: Mapped[PatternResult] = relationship(back_populates="trade", uselist=False)
    alerts: Mapped[list[Alert]] = relationship(back_populates="trade")


class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    s3_url: Mapped[str]
    thumbnail_url: Mapped[str | None]
    uploaded_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(back_populates="images")


class PatternResult(Base):
    __tablename__ = "pattern_results"

    pattern_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    rule: Mapped[str]
    score: Mapped[float]
    advice: Mapped[str | None]
    diagnosed_at: Mapped[datetime]

    trade: Mapped[Trade] = relationship(back_populates="pattern_result")


class Alert(Base):
    __tablename__ = "alerts"

    alert_id: Mapped[int] = mapped_column(primary_key=True)
    trade_id: Mapped[int] = mapped_column(ForeignKey("trades.trade_id"))
    type: Mapped[str]
    target_price: Mapped[float]
    triggered_at: Mapped[datetime | None]

    trade: Mapped[Trade] = relationship(back_populates="alerts")
