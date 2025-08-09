from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from deps import get_session
from schemas.auth import LoginResponse
from schemas import LoginRequest, RegisterRequest, OAuthRequest, User as UserSchema

from sqlalchemy import select
from models import User
from core.jwt import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
async def login(
    data: LoginRequest,
    session: AsyncSession = Depends(get_session),
) -> LoginResponse:
    stmt = select(User).where(User.email == data.email)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    if user and user.password == data.password:
        token = create_access_token({"sub": str(user.user_id)})
        return LoginResponse(token=token, user=user)

    raise HTTPException(status_code=401, detail="Unauthorized")


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, session: AsyncSession = Depends(get_session)) -> UserSchema:
    from uuid import uuid4
    from models import User

    new_user = User(
        user_id=uuid4(),
        email=data.email,
        password=data.password,
        role="user",
        plan="basic",
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    return UserSchema.from_orm(new_user)


@router.post("/oauth")
async def oauth_login(data: OAuthRequest) -> dict:
    return {"token": "dummy"}
