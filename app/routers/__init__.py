from fastapi import FastAPI

from . import auth, trades, images, patterns, alerts

routers = [
    auth.router,
    trades.router,
    images.router,
    patterns.router,
    alerts.router,
]


def register_routers(app: FastAPI) -> None:
    for r in routers:
        app.include_router(r)
