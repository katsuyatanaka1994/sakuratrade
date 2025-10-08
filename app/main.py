from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.core.settings import get_settings
from app.database import async_engine
from app.models import Base  # noqa: F401  # Ensure metadata import for Alembic autogenerate
from app.routers import advice, ai, analyze, chats, exit_feedback, images, integrated_advice, journal, trades

logger = logging.getLogger(__name__)

settings = get_settings()


async def _ping_database() -> None:
    async with async_engine.connect() as connection:
        await connection.execute(text("SELECT 1"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await _ping_database()
    except Exception as exc:  # noqa: BLE001 - startup failures should propagate after logging
        logger.exception("Database connectivity check failed during startup: %s", exc)
        raise
    yield
    await async_engine.dispose()


app = FastAPI(title="SaaS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(images.router)
app.include_router(analyze.router)
app.include_router(advice.router)
app.include_router(chats.router)
app.include_router(ai.router)
app.include_router(journal.router)
app.include_router(trades.router)
app.include_router(integrated_advice.router, prefix="/api/v1", tags=["integrated-analysis"])
app.include_router(exit_feedback.router, prefix="/api/v1", tags=["exit-feedback"])

app.mount("/static", StaticFiles(directory=Path("app/static")), name="static")


async def _health_response() -> tuple[int, dict[str, str]]:
    try:
        await _ping_database()
    except Exception:
        logger.exception("Health check failed (database unreachable)")
        return status.HTTP_503_SERVICE_UNAVAILABLE, {"status": "unhealthy"}
    return status.HTTP_200_OK, {"status": "ok"}


@app.get("/healthz")
async def healthz() -> JSONResponse:
    status_code, payload = await _health_response()
    return JSONResponse(status_code=status_code, content=payload)


@app.get("/health")
async def legacy_health() -> JSONResponse:
    status_code, payload = await _health_response()
    return JSONResponse(status_code=status_code, content=payload)
