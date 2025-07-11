from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_session
from .. import schemas

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def register(data: schemas.RegisterRequest, session: AsyncSession = Depends(get_session)) -> schemas.User:
    # TODO: persist user
    return schemas.User(user_id="00000000-0000-0000-0000-000000000000", email=data.email)


@router.post("/oauth")
async def oauth_login(data: schemas.OAuthRequest) -> dict:
    # TODO: validate provider token
    return {"token": "dummy"}
