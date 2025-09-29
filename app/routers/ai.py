import logging
import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.models import Chat, ChatMessage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["ai"])


class AIReplyRequest(BaseModel):
    chatId: str
    latestUserMessageId: str
    context: Optional[dict] = {}


@router.post("/reply")
async def generate_ai_reply(request: AIReplyRequest, db: AsyncSession = Depends(get_async_db)):
    """
    AI返信を生成する（モック実装）
    """
    try:
        # チャットの存在確認
        chat_stmt = select(Chat).where(Chat.id == request.chatId, Chat.deleted_at.is_(None))
        chat_result = await db.execute(chat_stmt)
        chat = chat_result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID {request.chatId} not found")

        # ユーザーメッセージの存在確認
        user_msg_stmt = select(ChatMessage).where(ChatMessage.id == request.latestUserMessageId)
        user_msg_result = await db.execute(user_msg_stmt)
        user_message = user_msg_result.scalar_one_or_none()

        if not user_message:
            raise HTTPException(status_code=404, detail=f"User message with ID {request.latestUserMessageId} not found")

        # TODO: 実際のAI生成ロジックを実装
        # 現在はモック応答を生成
        ai_response = (
            f"AI応答が生成されました。メッセージの更新/Undo後の再分析結果です。"
            f"（参照メッセージID: {request.latestUserMessageId}）"
        )

        # AI返信メッセージを作成
        ai_message_id = str(uuid.uuid4())

        ai_stmt = insert(ChatMessage).values(
            id=ai_message_id,
            chat_id=request.chatId,
            type="TEXT",
            author_id="ai-system",
            text=ai_response,
            created_at=datetime.utcnow(),
        )

        await db.execute(ai_stmt)

        # チャットの更新日時を更新
        update_chat_stmt = update(Chat).where(Chat.id == request.chatId).values(updated_at=datetime.utcnow())
        await db.execute(update_chat_stmt)

        await db.commit()

        logger.info(f"AI reply generated for chat {request.chatId}")

        return {
            "message": "AI reply generated successfully",
            "ai_message_id": ai_message_id,
            "response": ai_response,
            "chat_id": request.chatId,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating AI reply: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
