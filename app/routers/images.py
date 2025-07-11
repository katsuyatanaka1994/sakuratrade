from fastapi import APIRouter, status
<<<<<<< HEAD
from typing import List
import uuid
from datetime import datetime
from app.schemas import Image

router = APIRouter(prefix="/images", tags=["images"])

@router.get("", response_model=List[Image])
async def list_images():
    """ダミー: 空リストを返す"""
    return []

@router.post("", response_model=Image, status_code=status.HTTP_201_CREATED)
async def create_image(payload: Image):
    """ダミー: 受け取ったデータを返しつつIDと日時を補完"""
    data = payload.model_dump()
    data["imageId"] = str(data.get("imageId") or uuid.uuid4())
    data["uploadedAt"] = data.get("uploadedAt") or datetime.utcnow().isoformat()
    return Image(**data)
=======

from .. import schemas

router = APIRouter(prefix="/images", tags=["images"])


@router.post("", status_code=status.HTTP_200_OK)
async def presign_upload(data: dict) -> dict:
    # TODO: create pre-signed URL
    return {"s3_url": "https://example.com/upload"}
>>>>>>> origin/main
