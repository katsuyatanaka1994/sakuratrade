from fastapi import APIRouter, status

from .. import schemas

router = APIRouter(prefix="/images", tags=["images"])


@router.post("", status_code=status.HTTP_200_OK)
async def presign_upload(data: dict) -> dict:
    # TODO: create pre-signed URL
    return {"s3_url": "https://example.com/upload"}
