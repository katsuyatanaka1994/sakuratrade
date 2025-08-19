from fastapi import FastAPI

from routers import auth, trades, images, patterns, alerts, journal

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
