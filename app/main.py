from fastapi import FastAPI
from .routers import register_routers

app = FastAPI(title="SaaS API")

register_routers(app)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
