from fastapi import APIRouter, status
from typing import List
import uuid
from datetime import datetime
from app.schemas import Alert, AlertType

router = APIRouter(prefix="/alerts", tags=["alerts"])

@router.get("", response_model=List[Alert])
async def list_alerts():
    """ダミー: 空リストを返す"""
    return []

@router.post("", response_model=Alert, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: Alert):
    """ダミー: 受信データを返しつつ ID と日時を補完"""
    data = payload.model_dump()
    data["alertId"] = str(data.get("alertId") or uuid.uuid4())
    data["triggeredAt"] = data.get("triggeredAt") or datetime.utcnow().isoformat()
    return Alert(**data)
