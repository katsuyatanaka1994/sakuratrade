from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, insert
from database import get_async_db
from models import Chat
from datetime import datetime
from typing import List, Optional
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chats", tags=["chats"])

class CreateChatRequest(BaseModel):
    name: str
    user_id: Optional[str] = None
    messages_json: Optional[str] = None

@router.post("/")
async def create_chat(
    request: CreateChatRequest,
    db: AsyncSession = Depends(get_async_db)
):
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
        
        stmt = insert(Chat).values(
            id=chat_id,
            name=request.name,
            user_id=request.user_id,
            messages_json=request.messages_json,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        await db.execute(stmt)
        await db.commit()
        
        logger.info(f"Chat {chat_id} created successfully")
        
        return {
            "id": chat_id,
            "name": request.name,
            "user_id": request.user_id,
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error creating chat: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.delete("/{chat_id}")
async def delete_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_async_db)
):
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
            Chat.deleted_at.is_(None)  # 未削除のもののみ
        )
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        
        if not chat:
            raise HTTPException(
                status_code=404,
                detail=f"Chat with ID {chat_id} not found or already deleted"
            )
        
        # ソフトデリート実行
        stmt = update(Chat).where(
            Chat.id == chat_id
        ).values(
            deleted_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        await db.execute(stmt)
        await db.commit()
        
        logger.info(f"Chat {chat_id} soft deleted successfully")
        
        return {
            "message": "Chat deleted successfully",
            "chat_id": chat_id,
            "deleted_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting chat {chat_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/")
async def list_chats(
    include_deleted: bool = False,
    limit: Optional[int] = 100,
    db: AsyncSession = Depends(get_async_db)
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
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/{chat_id}/restore")
async def restore_chat(
    chat_id: str,
    db: AsyncSession = Depends(get_async_db)
):
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
        stmt = select(Chat).where(
            Chat.id == chat_id,
            Chat.deleted_at.is_not(None)
        )
        result = await db.execute(stmt)
        chat = result.scalar_one_or_none()
        
        if not chat:
            raise HTTPException(
                status_code=404,
                detail=f"Deleted chat with ID {chat_id} not found"
            )
        
        # 復元実行
        stmt = update(Chat).where(
            Chat.id == chat_id
        ).values(
            deleted_at=None,
            updated_at=datetime.utcnow()
        )
        
        await db.execute(stmt)
        await db.commit()
        
        logger.info(f"Chat {chat_id} restored successfully")
        
        return {
            "message": "Chat restored successfully",
            "chat_id": chat_id,
            "restored_at": datetime.utcnow().isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error restoring chat {chat_id}: {str(e)}")
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )