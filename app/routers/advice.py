import markdown2
from jinja2 import Template
from fastapi import APIRouter, Request, UploadFile, File, Body
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from services.strategy_estimator import estimate_strategy
from schemas.indicator_facts import IndicatorFacts

router = APIRouter()
templates = Jinja2Templates(directory="app/templates")

entry_advice_template = Template("""
## ✅ 現在の状況（{{ time }}時点）

### 🔍 テクニカルチェック

| 項目 | 状況 |
| --- | --- |
| 下降トレンド入り | {{ trend_check }} |
| ボリンジャーバンド収束 | {{ bollinger_contraction }} |
| RSI過熱感 | {{ rsi_overheat }} |

### 📈 価格動向

| 指標 | 値 |
| --- | --- |
| 現在価格 | {{ current_price }} |
| 移動平均線 | {{ moving_average }} |

## ✅ 今の判断まとめ

| 判断項目 | 結果 |
| --- | --- |
| エントリー推奨 | {{ entry_recommendation }} |
| 利確ポイント | {{ take_profit_point }} |
| 損切りポイント | {{ stop_loss_point }} |

## 🧠 今できること（戦略タスク）

{% if strategy.tactical_summary %}
<ul>
{% for item in strategy.tactical_summary %}
  <li>{{ item }}</li>
{% endfor %}
</ul>
{% endif %}
""")

def generate_entry_advice(facts: IndicatorFacts) -> str:
    strategy = estimate_strategy(facts)
    facts_dict = facts.dict()
    raw_markdown = entry_advice_template.render(
        time=facts_dict.get("time", "未指定"),
        trend_check=facts_dict.get("trend_check", ""),
        bollinger_contraction=facts_dict.get("bollinger_contraction", ""),
        rsi_overheat=facts_dict.get("rsi_overheat", ""),
        current_price=facts_dict.get("current_price", ""),
        moving_average=facts_dict.get("moving_average", ""),
        entry_recommendation=strategy.get("entry_recommendation", ""),
        take_profit_point=strategy.get("take_profit_point", ""),
        stop_loss_point=strategy.get("stop_loss_point", ""),
        strategy=strategy
    )
    html = markdown2.markdown(raw_markdown, extras=["tables"])
    # print("=== Generated HTML ===")
    # print(repr(html))
    # print("======================")
    return html

import base64
import os
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

@router.post("/advice")
async def advice(
    request: Request,
    file: UploadFile = File(None),
    message: str = Body(None),
    entry_price: float = Body(None),
    exit_price: float = Body(None)
):
    # Attempt to extract message if not provided by FastAPI Body parsing
    data = {}
    try:
        data = await request.json()
    except Exception as e:
        # print("Failed to parse request.json():", e)
        pass
    if not message and isinstance(data, dict):
        message = data.get("message")

    # print("=== /advice endpoint reached ===")
    # print("Message extracted from request:", message)
    """
    Accepts an image file upload or a text question, analyzes it with OpenAI Vision (placeholder),
    and returns advice text.
    """
    try:
        # Case 1: Trade prices provided
        if entry_price is not None and exit_price is not None:
            # Simple advice based on provided prices
            return {"message": f"建値: {entry_price}円、決済値: {exit_price}円を受け付けました。リスクとリワードを確認してトレード戦略を検討してください。"}
        
        # Case 2: Text question provided
        if message:
            # Handle text question input
            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "あなたは日本株のプロトレーダー兼アナリストです。"
                            "ユーザーからの質問に対し、必ず日本語で初心者にも理解できるように、"
                            "テクニカル分析を中心とした論理的なアドバイスをMarkdown形式で提供してください。"
                            "質問が不明確でも、一般知識や推測を交えて必ず回答を作成してください。"
                        )
                    },
                    {
                        "role": "user",
                        "content": message
                    }
                ],
                "max_tokens": 500
            }
            # print("=== Payload Sent to OpenAI (Text Question) ===")
            # print(payload)
            # print("Headers:", headers)
            # print("==============================================")
            # print("Message content received in endpoint:", message)
            response = requests.post(OPENAI_API_URL, headers=headers, json=payload)
            # print("=== OpenAI Response Status Code ===", response.status_code)
            if response.status_code != 200:
                return {"error": f"OpenAI API request failed: {response.text}"}
            result = response.json()
            # print("=== OpenAI API Raw Result (Text Question) ===")
            # print(result)
            # print("=============================================")
            # print("Keys in OpenAI result:", result.keys())
            if "choices" in result:
                # print("Number of choices:", len(result["choices"]))
                if len(result["choices"]) > 0:
                    # print("Choice 0 keys:", result["choices"][0].keys())
                    if "message" in result["choices"][0]:
                        # print("Message content:", result["choices"][0]["message"].get("content", ""))
                        pass
                    if "text" in result["choices"][0]:
                        # print("Text content:", result["choices"][0]["text"])
                        pass
            choices = result.get("choices", [])
            # print("=== OpenAI choices content ===")
            # print(choices)
            # print("==============================")
            advice_text = ""

            if choices and isinstance(choices[0], dict):
                if "message" in choices[0] and "content" in choices[0]["message"]:
                    advice_text = choices[0]["message"]["content"].strip()
                elif "text" in choices[0]:
                    advice_text = choices[0]["text"].strip()

            if not advice_text:
                return {"message": "⚠️ AIから有効な回答が返りませんでした。質問をより具体的にして再度お試しください。"}

            return {"message": advice_text}
        else:
            # print("No message content detected in request body")
            pass

        if file:
            content = await file.read()
            encoded_image = base64.b64encode(content).decode("utf-8")

            headers = {
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json"
            }

            payload = {
                "model": "gpt-4o-mini",
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "あなたはプロの株式スイングトレーダー兼アナリストです。"
                            "まず、画像から銘柄名（企業名、証券コード、Ticker）を特定してください。"
                            "銘柄名は以下の優先順位で抽出：1)証券コード（4桁数字）2)カタカナ企業名 3)漢字企業名 4)英語企業名\n"
                            "その後、以下のフォーマットに従い、日本語で初心者にも分かりやすく詳細かつ論理的に解析結果をMarkdown形式で出力してください。\n\n"
                            "STOCK_NAME_EXTRACTED: {抽出した銘柄名}\n"
                            "📊 {銘柄名（証券コード）} チャート分析（{日付・時刻時点}）\n"
                            "⸻\n"
                            "✅ テクニカル分析まとめ\n\n"
                            "🟢 株価動向\n"
                            "・現在値、前日比、高値、安値、終値、トレンド方向を簡潔に解説\n\n"
                            "⸻\n"
                            "📈 移動平均線\n"
                            "・短期・中期・長期線の状況を解説\n\n"
                            "⸻\n"
                            "🔸 出来高\n"
                            "・出来高状況、買い圧力や売り圧力のコメント\n\n"
                            "⸻\n"
                            "🔶 RSI（相対力指数）\n"
                            "・RSI値と解釈を解説\n\n"
                            "🎯 エントリーポイント戦略\n"
                            "パターン / 条件 / エントリー価格目安 / ストップライン / 利確目標 / リスクリワードを簡潔に提示\n\n"
                            "🧠 補足\n"
                            "・トレード判断に影響するポイントや注意事項\n\n"
                            "このフォーマットを必ず守り、Markdown形式で出力してください。"
                        )
                    },
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": "この株価チャート画像を解析し、現在のトレンド、エントリーポイント、損切り・利確目安を教えてください。"},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{encoded_image}"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 500
            }

            response = requests.post(OPENAI_API_URL, headers=headers, json=payload)
            if response.status_code != 200:
                return {"error": f"OpenAI API request failed: {response.text}"}

            result = response.json()
            advice_text = result["choices"][0]["message"]["content"]
            
            # Extract stock name from AI response
            extracted_stock_name = None
            if "STOCK_NAME_EXTRACTED:" in advice_text:
                lines = advice_text.split('\n')
                for line in lines:
                    if line.strip().startswith("STOCK_NAME_EXTRACTED:"):
                        extracted_stock_name = line.replace("STOCK_NAME_EXTRACTED:", "").strip()
                        break
                # Remove the extraction line from the display text
                advice_text = '\n'.join([line for line in lines if not line.strip().startswith("STOCK_NAME_EXTRACTED:")])

            return {
                "filename": file.filename,
                "message": advice_text,
                "extracted_stock_name": extracted_stock_name
            }
        return {"error": "ファイルまたはメッセージを提供してください。"}
    except Exception as e:
        return {
            "error": f"ファイル解析中にエラーが発生しました: {str(e)}"
        }