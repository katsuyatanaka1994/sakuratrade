import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


pytestmark = pytest.mark.asyncio


async def test_create_trade():
    payload = {
        "userId": "00000000-0000-0000-0000-000000000000",
        "ticker": "T",
        "side": "LONG",
        "priceIn": 1.0,
        "size": 1.0,
        "enteredAt": "2021-01-01T00:00:00Z",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/trades", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert "tradeId" in data
    assert data["userId"] == payload["userId"]
