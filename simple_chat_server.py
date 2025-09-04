#!/usr/bin/env python3
"""
メッセージ編集機能テスト用の簡易ChatAPIサーバー
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import os
import urllib.request
import urllib.error
import uuid
from datetime import datetime, timedelta, timezone
import json

app = FastAPI(title="Chat Message Edit API", version="1.0.0")


def now_iso_utc() -> str:
    """Return ISO8601 with UTC timezone offset (e.g., 2025-09-04T08:30:00.123456+00:00)."""
    return datetime.now(timezone.utc).isoformat()

# CORS設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# インメモリストレージ
chats_storage: Dict[str, Dict] = {}
messages_storage: Dict[str, Dict] = {}

# Pydanticモデル
class EntryPayload(BaseModel):
    symbolCode: str
    symbolName: str
    side: str  # "LONG" or "SHORT"
    price: float
    qty: int
    note: Optional[str] = None
    executedAt: Optional[str] = None
    tradeId: str

class ExitPayload(BaseModel):
    tradeId: str
    exitPrice: float
    exitQty: int
    note: Optional[str] = None
    executedAt: Optional[str] = None

class ChatMessageCreate(BaseModel):
    type: str  # "TEXT", "ENTRY", "EXIT"
    author_id: str
    text: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

class ChatMessageUpdate(BaseModel):
    type: str
    text: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None

class AIReplyRequest(BaseModel):
    chatId: str
    latestUserMessageId: str
    context: Optional[dict] = {}

# ヘルスチェック
@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": now_iso_utc()}

# チャット作成
class CreateChatRequest(BaseModel):
    name: str
    user_id: Optional[str] = None
    messages_json: Optional[str] = None

@app.post("/chats/")
async def create_chat(request: CreateChatRequest):
    """新しいチャットを作成"""
    
    chat_id = str(uuid.uuid4())
    
    new_chat = {
        "id": chat_id,
        "name": request.name,
        "user_id": request.user_id,
        "created_at": now_iso_utc(),
        "updated_at": now_iso_utc()
    }
    
    chats_storage[chat_id] = new_chat
    
    print(f"✅ チャット作成: {chat_id} (名前: {request.name})")
    
    return new_chat

# チャット一覧取得
@app.get("/chats/")
async def list_chats(limit: Optional[int] = 100):
    """チャット一覧を取得"""
    
    chat_list = list(chats_storage.values())
    
    # 更新日時でソート
    chat_list.sort(key=lambda x: x["updated_at"], reverse=True)
    
    # 件数制限
    if limit:
        chat_list = chat_list[:limit]
    
    return chat_list

# チャット作成（デフォルトチャット）
@app.on_event("startup")
async def create_default_chat():
    """デフォルトチャットを作成"""
    chat_id = "default-chat-123"
    chats_storage[chat_id] = {
        "id": chat_id,
        "name": "デフォルトチャット",
        "created_at": now_iso_utc(),
        "updated_at": now_iso_utc()
    }
    print(f"✅ デフォルトチャット作成: {chat_id}")

# メッセージ作成
@app.post("/chats/{chat_id}/messages")
async def create_message(chat_id: str, message: ChatMessageCreate):
    """新しいメッセージを作成"""
    
    # チャットの存在確認
    if chat_id not in chats_storage:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    
    # メッセージIDを生成
    message_id = str(uuid.uuid4())
    
    # メッセージを作成
    new_message = {
        "id": message_id,
        "chat_id": chat_id,
        "type": message.type,
        "author_id": message.author_id,
        "text": message.text,
        "payload": message.payload,
        "created_at": now_iso_utc(),
        "updated_at": None
    }
    
    messages_storage[message_id] = new_message
    
    # チャットの更新日時を更新
    chats_storage[chat_id]["updated_at"] = now_iso_utc()
    
    print(f"✅ メッセージ作成: {message_id} (タイプ: {message.type})")
    
    return new_message

# 決済済みENTRYメッセージかをチェックする関数
def is_entry_settled(message_text: str) -> bool:
    """簡易的な決済済みチェック - テスト用"""
    if not message_text or '建値入力しました' not in message_text:
        return False
    
    # テスト用: 特定のケースで決済済みとしてシミュレート
    # 実際の実装では、ポジションストアとの連携が必要
    # カンマありなしの両パターンに対応
    if ('2000円' in message_text or '2,000円' in message_text):
        print(f"🚫 決済済みパターン検知: {message_text[:100]}...")
        return True
    
    return False

# メッセージ更新
@app.patch("/chats/messages/{message_id}")
async def update_message(message_id: str, message_update: ChatMessageUpdate):
    """メッセージを更新（編集機能）"""
    
    # メッセージの存在確認
    if message_id not in messages_storage:
        raise HTTPException(status_code=404, detail=f"Message {message_id} not found")
    
    message = messages_storage[message_id]
    
    # 決済済みENTRYメッセージの編集チェック
    current_text = message.get("text", "")
    new_text = message_update.text or ""
    
    print(f"🔍 決済チェック - current_text: {current_text[:50]}...")
    print(f"🔍 決済チェック - new_text: {new_text[:50]}...")
    print(f"🔍 決済チェック - is_settled(current): {is_entry_settled(current_text)}")
    print(f"🔍 決済チェック - is_settled(new): {is_entry_settled(new_text)}")
    
    if (is_entry_settled(current_text) or is_entry_settled(new_text)):
        print(f"🚫 決済済みENTRY編集拒否: {message_id}")
        raise HTTPException(
            status_code=409, 
            detail="Cannot edit settled ENTRY message. Position is already closed."
        )
    
    # 更新データを適用
    message["type"] = message_update.type
    message["updated_at"] = now_iso_utc()
    
    if message_update.type == "TEXT":
        message["text"] = message_update.text
        message["payload"] = None
    elif message_update.type in ["ENTRY", "EXIT"]:
        message["text"] = None
        message["payload"] = message_update.payload
    
    # チャットの更新日時を更新
    chat_id = message["chat_id"]
    if chat_id in chats_storage:
        chats_storage[chat_id]["updated_at"] = now_iso_utc()
    
    print(f"✅ メッセージ更新: {message_id} (タイプ: {message_update.type})")
    
    return message

# メッセージ取得
@app.get("/chats/{chat_id}/messages")
async def get_messages(chat_id: str, limit: Optional[int] = 100, offset: Optional[int] = 0):
    """チャットのメッセージ一覧を取得"""
    
    # チャットの存在確認
    if chat_id not in chats_storage:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    
    # チャットのメッセージを取得
    chat_messages = [
        msg for msg in messages_storage.values() 
        if msg["chat_id"] == chat_id
    ]
    
    # 作成日時でソート
    chat_messages.sort(key=lambda x: x["created_at"])
    
    # ページネーション
    if offset:
        chat_messages = chat_messages[offset:]
    if limit:
        chat_messages = chat_messages[:limit]
    
    return chat_messages

# Undoエンドポイント
@app.post("/chats/messages/{message_id}/undo")
async def undo_message(message_id: str):
    """決済メッセージの取り消し（Undo）"""
    
    # メッセージの存在確認
    if message_id not in messages_storage:
        raise HTTPException(status_code=404, detail=f"Message {message_id} not found")
    
    message = messages_storage[message_id]
    
    # EXITメッセージのみUndo可能
    if message["type"] != "EXIT":
        raise HTTPException(status_code=400, detail="Only EXIT messages can be undone")
    
    # 時間制限チェック（30分以内のみ）
    created_at = datetime.fromisoformat(message["created_at"])
    time_limit = datetime.utcnow() - timedelta(minutes=30)
    
    if created_at < time_limit:
        raise HTTPException(status_code=400, detail="Message is too old to undo (30 minutes limit)")
    
    # メッセージを削除
    chat_id = message["chat_id"]
    del messages_storage[message_id]
    
    # チャットの更新日時を更新
    if chat_id in chats_storage:
        chats_storage[chat_id]["updated_at"] = now_iso_utc()
    
    print(f"✅ メッセージUndo: {message_id}")
    
    return {
        "message": "Message undone successfully",
        "message_id": message_id,
        "undone_at": now_iso_utc()
    }

# ===== AI返信生成 =====
@app.post("/ai/reply")
async def generate_ai_reply(request: AIReplyRequest):
    """AI返信を生成（モック実装）"""
    
    chat_id = request.chatId
    latest_user_message_id = request.latestUserMessageId
    
    # チャットの存在確認
    if chat_id not in chats_storage:
        raise HTTPException(status_code=404, detail=f"Chat {chat_id} not found")
    
    # ユーザーメッセージの存在確認
    if latest_user_message_id not in messages_storage:
        raise HTTPException(status_code=404, detail=f"Message {latest_user_message_id} not found")
    
    user_message = messages_storage[latest_user_message_id]

    # 実API呼び出し（OPENAI_API_KEYが設定されている場合のみ）
    ai_response: str | None = None
    api_key = os.getenv("OPENAI_API_KEY")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if api_key:
        try:
            # Chat Completions API を使用（依存導入不要のurllib）
            url = "https://api.openai.com/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }

            latest_text = user_message.get("text") or str(user_message.get("type"))
            payload = {
                "model": model,
                "messages": [
                    {"role": "system", "content": "あなたは日本語で簡潔に答える投資アシスタントです。専門用語は短く補足してください。"},
                    {"role": "user", "content": latest_text},
                ],
                "temperature": 0.3,
            }

            req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                ai_response = (data.get("choices", [{}])[0]
                                   .get("message", {})
                                   .get("content"))
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, Exception) as e:
            print(f"❌ OpenAI呼び出し失敗: {e}")
            ai_response = None

    # フォールバック（モック）
    if not ai_response:
        ai_response = (
            f"AI応答: メッセージ「{user_message.get('text', user_message.get('type', 'メッセージ'))}」に対する分析結果です。"
            "（現在はモック応答。OPENAI_API_KEY を設定すると実応答に切り替わります）"
        )
    
    # AI返信メッセージを作成
    ai_message_id = str(uuid.uuid4())
    
    ai_message = {
        "id": ai_message_id,
        "chat_id": chat_id,
        "type": "TEXT",
        "author_id": "ai-system",
        "text": ai_response,
        "payload": None,
        "created_at": now_iso_utc(),
        "updated_at": None
    }
    
    messages_storage[ai_message_id] = ai_message
    
    # チャットの更新日時を更新
    chats_storage[chat_id]["updated_at"] = now_iso_utc()
    
    print(f"✅ AI返信生成: {ai_message_id}")
    
    return {
        "message": "AI reply generated successfully",
        "ai_message_id": ai_message_id,
        "response": ai_response,
        "chat_id": chat_id
    }

# レガシー advice エンドポイント（Trade.tsx用の互換性）
class AdviceRequest(BaseModel):
    message: str
    chat_id: Optional[str] = None

@app.post("/advice")
async def legacy_advice(request: AdviceRequest):
    """レガシーadviceエンドポイント - Trade.tsx互換性のため"""
    
    # 簡単なモック応答
    response_message = f"「{request.message}」についてのAI分析結果です。この機能は新しいチャットシステムに移行中です。"
    
    return {
        "message": response_message,
        "status": "success",
        "chat_id": request.chat_id
    }

# デバッグ用エンドポイント
@app.get("/debug/messages")
async def debug_messages():
    """デバッグ用: 全メッセージを表示"""
    return {
        "messages": list(messages_storage.values()),
        "message_count": len(messages_storage)
    }

@app.get("/debug/chats")
async def debug_chats():
    """デバッグ用: 全チャットを表示"""
    return {
        "chats": list(chats_storage.values()),
        "chat_count": len(chats_storage)
    }

# Journal API endpoints (for Trade.tsx compatibility)
class JournalEntryModel(BaseModel):
    trade_id: str
    symbol: str
    side: str
    entry_price: float
    exit_price: float
    quantity: int
    pnl: float
    entry_time: str
    exit_time: str
    duration_minutes: int
    notes: Optional[str] = None

class TradeSnapshotModel(BaseModel):
    tradeId: str
    symbol: str
    symbolName: str
    side: str
    entryPrice: float
    exitPrice: Optional[float] = None
    totalQty: int
    exitQty: Optional[int] = None
    pnl: Optional[float] = None
    entryTime: str
    exitTime: Optional[str] = None
    duration: Optional[int] = None
    notes: Optional[str] = None

# Mock journal storage
journal_storage: Dict[str, JournalEntryModel] = {}

@app.get("/journal/")
async def get_journal_entries(
    fromDate: Optional[str] = None,
    toDate: Optional[str] = None,
    symbol: Optional[str] = None,
    pnl: Optional[str] = None
):
    """Journal entries retrieval endpoint"""
    
    entries = list(journal_storage.values())
    
    # Apply filters if provided
    if fromDate:
        entries = [e for e in entries if e.entry_time >= fromDate]
    if toDate:
        entries = [e for e in entries if e.entry_time <= toDate]
    if symbol:
        entries = [e for e in entries if symbol.upper() in e.symbol.upper()]
    if pnl == 'win':
        entries = [e for e in entries if e.pnl > 0]
    elif pnl == 'lose':
        entries = [e for e in entries if e.pnl < 0]
    
    # Sort by entry time (newest first)
    entries.sort(key=lambda x: x.entry_time, reverse=True)
    
    return entries

@app.post("/journal/close")
async def submit_journal_entry(trade_snapshot: TradeSnapshotModel):
    """Submit a completed trade to journal"""
    
    try:
        # Create journal entry from trade snapshot
        journal_entry = JournalEntryModel(
            trade_id=trade_snapshot.tradeId,
            symbol=trade_snapshot.symbol,
            side=trade_snapshot.side,
            entry_price=trade_snapshot.entryPrice,
            exit_price=trade_snapshot.exitPrice or trade_snapshot.entryPrice,
            quantity=trade_snapshot.totalQty,
            pnl=trade_snapshot.pnl or 0.0,
            entry_time=trade_snapshot.entryTime,
            exit_time=trade_snapshot.exitTime or datetime.utcnow().isoformat(),
            duration_minutes=trade_snapshot.duration or 0,
            notes=trade_snapshot.notes
        )
        
        # Store the entry
        journal_storage[trade_snapshot.tradeId] = journal_entry
        
        print(f"✅ Journal entry created: {trade_snapshot.tradeId} ({trade_snapshot.symbol})")
        
        return {
            "message": "Journal entry created successfully",
            "trade_id": trade_snapshot.tradeId,
            "entry": journal_entry
        }
        
    except Exception as e:
        print(f"❌ Journal entry failed: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Failed to create journal entry: {str(e)}")

@app.get("/journal/{trade_id}/feedback")
async def get_trade_feedback(trade_id: str):
    """Get AI feedback for a specific trade"""
    
    if trade_id not in journal_storage:
        raise HTTPException(status_code=404, detail=f"Trade {trade_id} not found")
    
    entry = journal_storage[trade_id]
    
    # Mock AI feedback
    feedback_html = f"""
    <div class="trade-feedback">
        <h3>トレード分析結果</h3>
        <p><strong>銘柄:</strong> {entry.symbol}</p>
        <p><strong>方向:</strong> {entry.side}</p>
        <p><strong>損益:</strong> ¥{entry.pnl:,.0f}</p>
        <p><strong>判定:</strong> {"良好なトレード" if entry.pnl > 0 else "改善の余地があるトレード"}</p>
        <p><strong>コメント:</strong> AIによる詳細な分析結果がここに表示されます。</p>
    </div>
    """
    
    return {
        "trade_id": trade_id,
        "feedback_html": feedback_html,
        "analysis_score": 0.8 if entry.pnl > 0 else 0.4,
        "generated_at": datetime.utcnow().isoformat()
    }

if __name__ == "__main__":
    import uvicorn
    print("🚀 簡易チャットAPIサーバーを起動中...")
    print("📍 URL: http://localhost:8000")
    print("📍 API Docs: http://localhost:8000/docs")
    print("📍 Health Check: http://localhost:8000/health")
    print("📍 Journal API: http://localhost:8000/journal/")
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
