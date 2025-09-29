from fastapi import FastAPI

from . import alerts, auth, images, journal, patterns, trades

routers = [
    auth.router,
    trades.router,
    images.router,
    patterns.router,
    alerts.router,
    journal.router,
]


def register_routers(app: FastAPI) -> None:
    for r in routers:
        app.include_router(r)
