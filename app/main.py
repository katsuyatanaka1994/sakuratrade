from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import register_routers
from routers import images
from routers import analyze
from routers import advice
from routers import chats
from routers import journal
from sqlalchemy.ext.asyncio import create_async_engine
from models import Base
import asyncio

import os
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:password@db:5432/gptset_dev")
engine = create_async_engine(DATABASE_URL, echo=True)

app = FastAPI(title="SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 開発用: 全てのオリジンを許可
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

register_routers(app)
app.include_router(images.router)
app.include_router(analyze.router)
# Add advice router
app.include_router(advice.router)
# Add chats router
app.include_router(chats.router)
# Add journal router
app.include_router(journal.router)
# 画像アップロードAPIルーターを含む全ルーターを登録

# Mount static files directory
# Serve static files (including uploaded images) from app/static
app.mount("/static", StaticFiles(directory=Path("app/static")), name="static")


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
