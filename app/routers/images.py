import shutil
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.schemas.image import Image

router = APIRouter(prefix="/images", tags=["images"])

UPLOAD_DIR = Path("app/static/uploaded_images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


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


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_image(file: UploadFile = File(...)):
    """画像ファイルを保存し、ファイル名とパスを返す"""
    try:
        file_suffix = Path(file.filename).suffix
        unique_name = f"{uuid.uuid4()}{file_suffix}"
        file_path = UPLOAD_DIR / unique_name

        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return {"filename": unique_name, "url": f"/static/uploaded_images/{unique_name}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
