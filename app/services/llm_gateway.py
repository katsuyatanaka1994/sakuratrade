# app/services/llm_gateway.py
from __future__ import annotations

import os
from typing import Dict, List

from app.config import MOCK_AI

# OpenAIクライアントは必要なときだけimport（MOCK時はimport不要）
_client = None


def _get_client():
    global _client
    if _client is None:
        from openai import OpenAI  # 遅延インポート

        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            # 本番モードでキーが無いのはエラー扱い
            raise RuntimeError("OpenAI API key not configured")
        _client = OpenAI(api_key=api_key)
    return _client


def chat_completion(
    messages: List[Dict[str, str]],
    model: str = "gpt-4o-mini",
    temperature: float = 0.2,
) -> str:
    """
    共通のチャット補完。MOCK_AI=trueのときは固定レスポンスを返す。
    戻り値は text（content のみ）を返す簡易版。
    """
    if MOCK_AI:
        # プロンプトの先頭数十文字を混ぜたダミー応答（テスト可読性のため）
        user = next((m["content"] for m in messages if m["role"] == "user"), "")
        return f"【MOCK】要約: {user[:50]} ... / 結論: シナリオは妥当。"

    client = _get_client()
    resp = client.chat.completions.create(
        model=model,
        temperature=temperature,
        messages=messages,
    )
    return resp.choices[0].message.content or ""
