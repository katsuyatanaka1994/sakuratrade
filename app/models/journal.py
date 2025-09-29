from sqlalchemy import JSON, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database import Base


class TradeJournal(Base):
    __tablename__ = "trade_journal"

    trade_id = Column(String, primary_key=True, unique=True)
    user_id = Column(String, nullable=True)  # For future user system
    chat_id = Column(String, nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False)  # LONG or SHORT

    # Trade metrics
    avg_entry = Column(Float, nullable=False)
    avg_exit = Column(Float, nullable=False)
    qty = Column(Integer, nullable=False)
    pnl_abs = Column(Float, nullable=False)
    pnl_pct = Column(Float, nullable=False)
    hold_minutes = Column(Integer, nullable=False)
    closed_at = Column(DateTime, nullable=False)

    # Feedback from chat
    feedback_text = Column(Text, nullable=True)
    feedback_tone = Column(String, nullable=True)  # praise or advice
    feedback_next_actions = Column(JSON, nullable=True)  # string array
    feedback_message_id = Column(String, nullable=True)

    # Analysis data (optional)
    analysis_score = Column(Integer, nullable=True)  # 0-100
    analysis_labels = Column(JSON, nullable=True)  # string array

    # Timestamps
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
