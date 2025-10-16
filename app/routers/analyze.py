from __future__ import annotations

import base64

from fastapi import APIRouter, File, HTTPException, UploadFile
from openai import OpenAI

from app.core.settings import get_settings

router = APIRouter(prefix="/analyze", tags=["analyze"])

settings = get_settings()
_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        api_key = settings.openai_api_key
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not configured")
        _client = OpenAI(api_key=api_key)
    return _client


@router.post("/chart")
async def analyze_chart_image(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="画像ファイルをアップロードしてください")

    image_bytes = await file.read()
    encoded_image = base64.b64encode(image_bytes).decode("utf-8")

    client = _get_client()

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "あなたは株式チャートのテクニカル分析アシスタントです。"},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                "このチャート画像を見て、上昇トレンドか下降トレンドか、"
                                "およびエントリー判断として『押し目』『戻り売り』『ブレイク直後』『トレンド無し』のいずれかを判定してください。"
                                "赤＝陽線、青＝陰線です。次の形式でJSONを出力してください：\n"
                                "{\n"
                                '  "trend": "上昇トレンド または 下降トレンド または トレンドなし",\n'
                                '  "entry_pattern": "押し目・戻り売り・ブレイク直後・トレンド無しのいずれか",\n'
                                '  "confidence": 数値（0.0〜1.0）, \n'
                                '  "reason": "診断の理由"\n'
                                "}"
                            ),
                        },
                        {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{encoded_image}"}},
                    ],
                },
            ],
            max_tokens=500,
            temperature=0.3,
        )

        return {"analysis": response.choices[0].message.content}

    except Exception as exc:  # noqa: BLE001 - propagate as 500 for client visibility
        raise HTTPException(status_code=500, detail=f"診断エラー: {exc}")
