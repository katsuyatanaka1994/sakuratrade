from __future__ import annotations

import os
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.future import select

from app.core.settings import JWT_ALGORITHM, JWT_SECRET_KEY
from app.models import User

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost/db")

engine = create_async_engine(DATABASE_URL, future=True, echo=False)
async_session = async_sessionmaker(engine, expire_on_commit=False)


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        yield session


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme), session: AsyncSession = Depends(get_session)) -> User:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    result = await session.execute(select(User).where(User.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
