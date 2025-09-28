from sqlalchemy import Column, DateTime, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    content = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
