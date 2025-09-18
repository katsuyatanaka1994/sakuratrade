#!/usr/bin/env python3
"""
簡単なバックエンドサーバー（メッセージ編集機能テスト用）
"""

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Text, DateTime, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any, Union, Literal
import uuid

# Database setup
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Models
class ChatMessageDB(Base):
    __tablename__ = "chat_messages"
    
    id = Column(String, primary_key=True)
    chat_id = Column(String, nullable=False)
    type = Column(String, nullable=False)
    author_id = Column(String, nullable=False)
    text = Column(Text, nullable=True)
    payload = Column(JSON, nullable=True)
    created_at = Column(DateTime, nullable=False)
    updated_at = Column(DateTime, nullable=True)

# Create tables
Base.metadata.create_all(bind=engine)

# FastAPI app
app = FastAPI(title="Message Edit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models
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

class MessageUpdate(BaseModel):
    type: Literal['TEXT', 'ENTRY', 'EXIT']
    text: Optional[str] = None
    payload: Optional[Union[EntryPayload, ExitPayload]] = None

# API endpoints
@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.patch("/chats/messages/{message_id}")
def update_message(
    message_id: str,
    update_data: MessageUpdate,
    db: Session = Depends(get_db)
):
    # Find message
    message = db.query(ChatMessageDB).filter(ChatMessageDB.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Update message
    message.type = update_data.type
    message.updated_at = datetime.utcnow()
    
    if update_data.type == 'TEXT':
        message.text = update_data.text
        message.payload = None
    else:
        message.text = None
        message.payload = update_data.payload.dict() if update_data.payload else None
    
    db.commit()
    db.refresh(message)
    
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "type": message.type,
        "author_id": message.author_id,
        "text": message.text,
        "payload": message.payload,
        "created_at": message.created_at.isoformat(),
        "updated_at": message.updated_at.isoformat() if message.updated_at else None
    }

@app.post("/chats/{chat_id}/messages")
def create_message(
    chat_id: str,
    message_data: dict,
    db: Session = Depends(get_db)
):
    message_id = str(uuid.uuid4())
    
    message = ChatMessageDB(
        id=message_id,
        chat_id=chat_id,
        type=message_data.get("type", "TEXT"),
        author_id=message_data.get("author_id", "user"),
        text=message_data.get("text"),
        payload=message_data.get("payload"),
        created_at=datetime.utcnow()
    )
    
    db.add(message)
    db.commit()
    db.refresh(message)
    
    return {
        "id": message.id,
        "chat_id": message.chat_id,
        "type": message.type,
        "author_id": message.author_id,
        "text": message.text,
        "payload": message.payload,
        "created_at": message.created_at.isoformat(),
        "updated_at": None
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 Simple Backend Server starting on http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)
