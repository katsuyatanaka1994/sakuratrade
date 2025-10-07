import hashlib
import io
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile, status
from PIL import Image as PILImage
from PIL import UnidentifiedImageError

from app.schemas.image import Image

router = APIRouter(prefix="/images", tags=["images"])

UPLOAD_DIR = Path("app/static/uploaded_images")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB
MAX_DIMENSION = 8000
THUMBNAIL_MAX = (1024, 1024)
ALLOWED_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}


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
    """Validate and persist an uploaded chart image."""

    try:
        content = await file.read()

        if not content:
            raise HTTPException(status_code=400, detail="EMPTY_FILE")

        if len(content) > MAX_IMAGE_BYTES:
            raise HTTPException(status_code=413, detail="IMAGE_TOO_LARGE")

        try:
            image = PILImage.open(io.BytesIO(content))
            image.verify()  # Validate file signature without decoding fully
        except UnidentifiedImageError as exc:
            raise HTTPException(status_code=415, detail="UNSUPPORTED_MEDIA_TYPE") from exc
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="INVALID_IMAGE") from exc

        # Re-open because verify() closes the file
        image = PILImage.open(io.BytesIO(content))
        fmt = image.format
        if fmt not in ALLOWED_FORMATS:
            raise HTTPException(status_code=415, detail="UNSUPPORTED_MEDIA_TYPE")

        width, height = image.size
        if width > MAX_DIMENSION or height > MAX_DIMENSION:
            raise HTTPException(status_code=400, detail="IMAGE_DIMENSION_EXCEEDED")

        digest = hashlib.sha256(content).hexdigest()
        extension = ALLOWED_FORMATS[fmt]
        unique_name = f"{digest}.{extension}"
        file_path = UPLOAD_DIR / unique_name

        # Persist original
        file_path.write_bytes(content)

        # Generate thumbnail
        thumbnail_name = f"{digest}_thumb.{extension}"
        thumb_path = UPLOAD_DIR / thumbnail_name
        thumb_image = image.copy()
        thumb_image.thumbnail(THUMBNAIL_MAX)
        buffer = io.BytesIO()
        thumb_image.save(buffer, format=fmt)
        thumb_path.write_bytes(buffer.getvalue())

        return {
            "filename": unique_name,
            "url": f"/static/uploaded_images/{unique_name}",
            "thumbnail_url": f"/static/uploaded_images/{thumbnail_name}",
            "width": width,
            "height": height,
        }
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(exc))
