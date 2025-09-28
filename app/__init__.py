from fastapi import FastAPI

from .routers import advice, images, trades


def register_routers(app: FastAPI):
    app.include_router(trades.router)
    app.include_router(images.router)
    app.include_router(advice.router)
