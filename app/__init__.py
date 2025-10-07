from fastapi import FastAPI


def register_routers(app: FastAPI) -> None:
    """Register application routers without triggering side effects on import."""

    # Import locally to avoid side effects during Alembic migrations.
    from app.routers import advice, images, trades  # pylint: disable=import-outside-toplevel

    app.include_router(trades.router)
    app.include_router(images.router)
    app.include_router(advice.router)


__all__ = ["register_routers"]
