import os
import sys

import pytest
from httpx import ASGITransport, AsyncClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app


@pytest.mark.asyncio
async def test_delete_entry_message():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        # Create chat container
        chat_response = await client.post("/chats/", json={"name": "削除テスト"})
        assert chat_response.status_code == 200, chat_response.text
        chat_data = chat_response.json()
        chat_id = chat_data["id"]

        # Create entry-like message under the chat
        message_payload = {
            "type": "TEXT",
            "author_id": "tester",
            "text": "📈 建値入力しました！",
        }
        message_response = await client.post(
            f"/chats/{chat_id}/messages",
            json=message_payload,
        )
        assert message_response.status_code == 200, message_response.text
        message_data = message_response.json()
        message_id = message_data["id"]

        # Delete message via the new endpoint
        delete_response = await client.delete(f"/chats/{chat_id}/messages/{message_id}")
        assert delete_response.status_code == 200, delete_response.text
        delete_body = delete_response.json()
        assert delete_body["chat_id"] == chat_id
        assert delete_body["message_id"] == message_id

        # Confirm the message is no longer returned in listings
        list_response = await client.get(f"/chats/{chat_id}/messages")
        assert list_response.status_code == 200, list_response.text
        remaining_ids = [msg["id"] for msg in list_response.json()]
        assert message_id not in remaining_ids

        # Second deletion gracefully returns 404 (already removed)
        second_delete = await client.delete(f"/chats/{chat_id}/messages/{message_id}")
        assert second_delete.status_code == 404, second_delete.text
