from __future__ import annotations

from app.core.settings import get_settings

settings = get_settings()

MOCK_AI: bool = settings.mock_ai
