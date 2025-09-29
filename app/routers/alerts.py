from datetime import datetime
from typing import List

from fastapi import APIRouter, status

from app.schemas.alert import Alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=List[Alert])
async def list_alerts():
    """ダミー: 空リストを返す"""
    return []


@router.post("", response_model=Alert, status_code=status.HTTP_201_CREATED)
async def create_alert(payload: Alert):
    """ダミー: 受信データを返しつつ ID と日時を補完"""
    data = payload.model_dump()
    data["alert_id"] = data.get("alert_id") or 1
    data["triggered_at"] = data.get("triggered_at") or datetime.utcnow()
    return Alert(**data)
