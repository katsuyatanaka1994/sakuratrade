from fastapi import APIRouter, status
from typing import List
import uuid
from datetime import datetime
from app.schemas import PatternResult

router = APIRouter(prefix="/patterns", tags=["patterns"])

@router.get("", response_model=List[PatternResult])
async def list_patterns():
    """ダミー: 空リストを返す"""
    return []

@router.post("", response_model=PatternResult, status_code=status.HTTP_201_CREATED)
async def create_pattern(payload: PatternResult):
    """ダミー: 受信データを返しつつ ID と日時を補完"""
    data = payload.model_dump()
    data["patternId"]   = str(data.get("patternId") or uuid.uuid4())
    data["diagnosedAt"] = data.get("diagnosedAt") or datetime.utcnow().isoformat()
    return PatternResult(**data)