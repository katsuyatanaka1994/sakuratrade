import os

MOCK_AI: bool = os.getenv("MOCK_AI", "false").lower() == "true"
