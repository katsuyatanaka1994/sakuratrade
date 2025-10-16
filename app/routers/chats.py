import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.models import Chat, ChatMessage
from app.schemas.chat_message import (
    ChatMessageCreate,
    ChatMessageUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chats", tags=["chats"])


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CreateChatRequest(BaseModel):
    name: str
    user_id: Optional[str] = None
    messages_json: Optional[str] = None


@router.post("/")
async def create_chat(request: CreateChatRequest, db: AsyncSession = Depends(get_async_db)):
    """
    新しいチャットを作成する

    Args:
        request: チャット作成リクエスト
        db: データベースセッション

    Returns:
        作成されたチャットの情報
    """
    try:
        import uuid

        chat_id = str(uuid.uuid4())

        now = _utc_now()

        stmt = insert(Chat).values(
            id=chat_id,
            name=request.name,
            user_id=request.user_id,
            messages_json=request.messages_json,
            created_at=now,
            updated_at=now,
        )

        await db.execute(stmt)
        await db.commit()

        logger.info("Chat %s created successfully", chat_id)

        return {
            "id": chat_id,
            "name": request.name,
            "user_id": request.user_id,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
        }

    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{chat_id}")
async def delete_chat(chat_id: str, db: AsyncSession = Depends(get_async_db)):
    """
    チャットをソフトデリートする

    Args:
        chat_id: 削除するチャットのID
        db: データベースセッション

    Returns:
        削除成功メッセージ

    Raises:
        HTTPException: チャットが見つからない場合
    """
    try:
        # チャットの存在確認
        stmt = select(Chat).where(
            Chat.id == chat_id,
            Chat.deleted_at.is_(None),  # 未削除のもののみ
        )
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID {chat_id} not found or already deleted")

        # ソフトデリート実行
        now = _utc_now()
        stmt = update(Chat).where(Chat.id == chat_id).values(deleted_at=now, updated_at=now)

        await db.execute(stmt)
        await db.commit()

        logger.info(f"Chat {chat_id} soft deleted successfully")

        return {"message": "Chat deleted successfully", "chat_id": chat_id, "deleted_at": now.isoformat()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/")
async def list_chats(
    include_deleted: bool = False, limit: Optional[int] = 100, db: AsyncSession = Depends(get_async_db)
):
    """
    チャット一覧を取得する

    Args:
        include_deleted: 削除されたチャットも含めるか
        limit: 取得件数の上限
        db: データベースセッション

    Returns:
        チャットのリスト
    """
    try:
        stmt = select(Chat)

        if not include_deleted:
            stmt = stmt.where(Chat.deleted_at.is_(None))

        if limit:
            stmt = stmt.limit(limit)

        stmt = stmt.order_by(Chat.updated_at.desc())

        result = await db.execute(stmt)
        chats = result.scalars().all()

        return [
            {
                "id": chat.id,
                "name": chat.name,
                "created_at": chat.created_at.isoformat() if chat.created_at else None,
                "updated_at": chat.updated_at.isoformat() if chat.updated_at else None,
                "deleted_at": chat.deleted_at.isoformat() if chat.deleted_at else None,
            }
            for chat in chats
        ]

    except Exception as e:
        logger.error(f"Error listing chats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/{chat_id}/restore")
async def restore_chat(chat_id: str, db: AsyncSession = Depends(get_async_db)):
    """
    削除されたチャットを復元する

    Args:
        chat_id: 復元するチャットのID
        db: データベースセッション

    Returns:
        復元成功メッセージ
    """
    try:
        # 削除されたチャットの存在確認
        stmt = select(Chat).where(Chat.id == chat_id, Chat.deleted_at.is_not(None))
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Deleted chat with ID {chat_id} not found")

        now = _utc_now()
        stmt = update(Chat).where(Chat.id == chat_id).values(deleted_at=None, updated_at=now)

        await db.execute(stmt)
        await db.commit()

        logger.info(f"Chat {chat_id} restored successfully")

        return {
            "message": "Chat restored successfully",
            "chat_id": chat_id,
            "restored_at": now.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring chat {chat_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# Message-related endpoints


@router.post("/{chat_id}/messages")
async def create_message(chat_id: str, message: ChatMessageCreate, db: AsyncSession = Depends(get_async_db)):
    """
    新しいメッセージを作成する
    """
    try:
        # チャットの存在確認
        chat_stmt = select(Chat).where(Chat.id == chat_id, Chat.deleted_at.is_(None))
        chat_result = await db.execute(chat_stmt)
        chat = chat_result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID {chat_id} not found")

        # メッセージIDを生成
        message_id = str(uuid.uuid4())

        # メッセージの内容を準備
        text = None
        payload = None

        if message.type == "TEXT":
            text = message.text
        elif message.type in ["ENTRY", "EXIT"]:
            payload = message.payload.dict()

        now = _utc_now()

        await db.execute(
            insert(ChatMessage).values(
                id=message_id,
                chat_id=chat_id,
                type=message.type,
                author_id=message.author_id,
                text=text,
                payload=payload,
                created_at=now,
            )
        )

        await db.execute(update(Chat).where(Chat.id == chat_id).values(updated_at=now))

        await db.commit()

        return {
            "id": message_id,
            "chat_id": chat_id,
            "type": message.type,
            "author_id": message.author_id,
            "text": text,
            "payload": payload,
            "created_at": now.isoformat(),
            "updated_at": None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error creating message in chat %s", chat_id)
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


def _is_entry_settled(message_content: str) -> bool:
    """
    Check if an ENTRY message represents a settled/closed position.
    This is a simplified check that looks for specific patterns.
    In a real implementation, this would check against a positions store.
    """
    if not message_content or "建値入力しました" not in message_content:
        return False

    # For now, return False to allow editing
    # TODO: Implement actual position checking logic
    # This would involve:
    # 1. Extract symbol and side from message content
    # 2. Check if position exists in positions store
    # 3. Return True if position is closed/settled
    return False


@router.patch("/messages/{message_id}")
async def update_message(
    message_id: str,
    message_update: ChatMessageUpdate,
    current_user_id: Optional[str] = None,  # TODO: Add proper auth
    db: AsyncSession = Depends(get_async_db),
):
    """
    メッセージを更新する（編集機能）
    """
    try:
        # メッセージの存在確認と権限チェック
        stmt = select(ChatMessage).where(ChatMessage.id == message_id)
        result = await db.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail=f"Message with ID {message_id} not found")

        # 権限チェック（著者のみ編集可能）
        # TODO: current_user_idが実装されるまでスキップ
        # if current_user_id and message.author_id != current_user_id:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="You can only edit your own messages"
        #     )

        # Check if trying to edit a settled ENTRY message
        # Check both existing message and new content
        current_content = message.text or ""
        new_content = message_update.text or message_update.content or ""

        if _is_entry_settled(current_content) or _is_entry_settled(new_content):
            raise HTTPException(
                status_code=409, detail="Cannot edit settled ENTRY message. Position is already closed."
            )

        # 更新データを準備
        update_data = {}

        # Handle text/content updates regardless of explicit type
        new_text_content = message_update.text or message_update.content
        if new_text_content is not None:
            update_data["text"] = new_text_content
            # For simplicity, keep original type unless explicitly changed
            if hasattr(message_update, "type") and message_update.type:
                update_data["type"] = message_update.type

        # Handle payload updates for ENTRY/EXIT
        if hasattr(message_update, "payload") and message_update.payload is not None:
            update_data["payload"] = message_update.payload.dict()
            if hasattr(message_update, "type") and message_update.type in ["ENTRY", "EXIT"]:
                update_data["type"] = message_update.type

        now = _utc_now()
        update_data["updated_at"] = now

        # メッセージを更新
        update_stmt = update(ChatMessage).where(ChatMessage.id == message_id).values(**update_data)

        await db.execute(update_stmt)

        # チャットの更新日時も更新
        await db.execute(update(Chat).where(Chat.id == message.chat_id).values(updated_at=now))

        await db.commit()

        # 更新されたメッセージを取得
        updated_stmt = select(ChatMessage).where(ChatMessage.id == message_id)
        updated_result = await db.execute(updated_stmt)
        updated_message = updated_result.scalar_one()

        return {
            "id": updated_message.id,
            "chat_id": updated_message.chat_id,
            "type": updated_message.type,
            "author_id": updated_message.author_id,
            "text": updated_message.text,
            "payload": updated_message.payload,
            "created_at": updated_message.created_at.isoformat() if updated_message.created_at else None,
            "updated_at": updated_message.updated_at.isoformat() if updated_message.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating message {message_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/{chat_id}/messages/{message_id}")
async def delete_message(chat_id: str, message_id: str, db: AsyncSession = Depends(get_async_db)):
    """指定したチャットからメッセージを安全に削除する"""
    try:
        # Ensure the parent chat exists and isn't soft-deleted
        chat_stmt = select(Chat).where(Chat.id == chat_id, Chat.deleted_at.is_(None))
        chat_result = await db.execute(chat_stmt)
        chat = chat_result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID {chat_id} not found")

        # Locate the target message within the chat
        message_stmt = select(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.chat_id == chat_id)
        message_result = await db.execute(message_stmt)
        message = message_result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail=f"Message with ID {message_id} not found in chat {chat_id}")

        # Remove the message
        await db.execute(delete(ChatMessage).where(ChatMessage.id == message_id, ChatMessage.chat_id == chat_id))

        now = _utc_now()
        await db.execute(update(Chat).where(Chat.id == chat_id).values(updated_at=now))

        await db.commit()

        logger.info(f"Deleted message {message_id} from chat {chat_id}")

        return {
            "message": "Chat message deleted successfully",
            "chat_id": chat_id,
            "message_id": message_id,
            "deleted_at": now.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting message {message_id} from chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{chat_id}/messages")
async def get_messages(
    chat_id: str, limit: Optional[int] = 100, offset: Optional[int] = 0, db: AsyncSession = Depends(get_async_db)
):
    """
    チャットのメッセージ一覧を取得する
    """
    try:
        # チャットの存在確認
        chat_stmt = select(Chat).where(Chat.id == chat_id, Chat.deleted_at.is_(None))
        chat_result = await db.execute(chat_stmt)
        chat = chat_result.scalar_one_or_none()

        if not chat:
            raise HTTPException(status_code=404, detail=f"Chat with ID {chat_id} not found")

        # メッセージを取得
        stmt = select(ChatMessage).where(ChatMessage.chat_id == chat_id).order_by(ChatMessage.created_at.asc())

        if limit:
            stmt = stmt.limit(limit)
        if offset:
            stmt = stmt.offset(offset)

        result = await db.execute(stmt)
        messages = result.scalars().all()

        return [
            {
                "id": msg.id,
                "chat_id": msg.chat_id,
                "type": msg.type,
                "author_id": msg.author_id,
                "text": msg.text,
                "payload": msg.payload,
                "created_at": msg.created_at.isoformat(),
                "updated_at": msg.updated_at.isoformat() if msg.updated_at else None,
            }
            for msg in messages
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting messages for chat {chat_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/messages/{message_id}/undo")
async def undo_message(
    message_id: str,
    current_user_id: Optional[str] = None,  # TODO: Add proper auth
    db: AsyncSession = Depends(get_async_db),
):
    """
    決済メッセージの取り消し（Undo）機能
    """
    try:
        # メッセージの存在確認
        stmt = select(ChatMessage).where(ChatMessage.id == message_id)
        result = await db.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(status_code=404, detail=f"Message with ID {message_id} not found")

        # EXITメッセージのみUndo可能
        if message.type != "EXIT":
            raise HTTPException(status_code=400, detail="Only EXIT messages can be undone")

        # 権限チェック（著者のみUndo可能）
        # TODO: current_user_idが実装されるまでスキップ
        # if current_user_id and message.author_id != current_user_id:
        #     raise HTTPException(
        #         status_code=403,
        #         detail="You can only undo your own messages"
        #     )

        # 時間制限チェック（30分以内のみ）
        from datetime import timedelta

        time_limit = _utc_now() - timedelta(minutes=30)
        if message.created_at < time_limit:
            raise HTTPException(status_code=400, detail="Message is too old to undo (30 minutes limit)")

        # メッセージを削除（実際は論理削除でも良い）
        from sqlalchemy import delete

        delete_stmt = delete(ChatMessage).where(ChatMessage.id == message_id)
        await db.execute(delete_stmt)

        # チャットの更新日時を更新
        now = _utc_now()
        await db.execute(update(Chat).where(Chat.id == message.chat_id).values(updated_at=now))

        await db.commit()

        logger.info(f"Message {message_id} undone successfully")

        return {"message": "Message undone successfully", "message_id": message_id, "undone_at": now.isoformat()}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error undoing message {message_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
