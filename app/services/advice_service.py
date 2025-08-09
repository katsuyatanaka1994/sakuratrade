from openai import OpenAI
import os
import markdown2
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# OpenAI APIキーの読み込み
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def generate_advice_from_chart(chart_facts: dict) -> str:
    """
    OpenAIにテンプレートを渡し、自然言語でアドバイスを生成する
    """
    template = """
## ✅ 現在の状況（{{ time }}時点）

### 🔍 テクニカルチェック

| 項目 | 状況 |
| --- | --- |
| 下降トレンド入り | {{ trend_check }} |
| 戻り高値を超えず | {{ resistance_check }} |
| 5MAを陰線が下抜け | {{ ma_break_check }} |
| RSI | {{ rsi_check }} |
| 出来高 | {{ volume_check }} |

→ 全体として「{{ overall_assessment }}」と判断できます。

## 🎯 ショート戦略（この局面の型）

### ✅ シナリオ：{{ scenario }}

### 🔽 エントリープラン

- エントリー価格目安：{{ entry_price }}
- 損切りライン：{{ stop_loss }}
- 利確目安：
    - 第一目標：{{ target1 }}
    - 第二目標：{{ target2 }}
    - その後は{{ trailing_strategy }}

## ⚠ 今後の注意ポイント

- {{ caution1 }}
- {{ caution2 }}

✅ 今の判断まとめ

| 判断 | 状況 |
| --- | --- |
| ロング | {{ long_judgement }} |
| ショート | {{ short_judgement }} |

📌 {{ final_comment }}
"""

    # 補完対象キー
    required_keys = [
        "time", "trend_check", "resistance_check", "ma_break_check", "rsi_check",
        "volume_check", "overall_assessment", "scenario", "entry_price", "stop_loss",
        "target1", "target2", "trailing_strategy", "caution1", "caution2",
        "long_judgement", "short_judgement", "final_comment"
    ]
    for key in required_keys:
        chart_facts.setdefault(key, "（未入力）")

    prompt = f"""
以下のテンプレートに chart_facts の値を埋め込んで、日本語の自然なアドバイスを生成してください。

テンプレート:
{template}

chart_facts:
{chart_facts}
"""

    print("=== Prompt ===")
    print(prompt)

    response = client.chat.completions.create(
        model="gpt-4",
        messages=[
            {"role": "system", "content": "あなたは日本株の短期トレードを支援するアドバイザーです。"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )

    print("=== Response ===")
    print(response)
    print(response.choices[0].message.content)
    markdown_text = response.choices[0].message.content
    print("=== Markdown Text ===")
    print(markdown_text)
    html_output = markdown2.markdown(markdown_text)
    return html_output


# --------------------------------------------------------------------------- #
# Dynamic chart_facts generator
# --------------------------------------------------------------------------- #
def extract_chart_facts(
    image_bytes: Optional[bytes] = None,
    indicators: Optional[dict] = None
) -> dict:
    """
    Build `chart_facts` dynamically.

    Priority order:
        1. Use provided `indicators` dict if present (e.g. fetched from DB).
        2. Else parse the uploaded chart image (PNG/JPEG) into facts.
    """

    # --- 1) DB‑saved indicator data takes priority --------------------------
    if indicators:
        return indicators

    # --- 2) Fallback: parse the chart image --------------------------------
    if image_bytes:
        return _parse_image_to_facts(image_bytes)

    # --- 3) Neither supplied ------------------------------------------------
    raise ValueError("Either `indicators` or `image_bytes` must be provided.")


def _parse_image_to_facts(image_bytes: bytes) -> dict:
    """
    Stub parser that converts raw image bytes into a minimal chart_facts dict.
    Replace with OpenCV / Vision API logic in a subsequent sprint.
    """
    # Placeholder implementation so the pipeline keeps working.
    return {
        "source": "image",
        "detected": False,
        "message": "Image parsing not implemented yet."
    }


# Alias for generate_entry_advice
generate_entry_advice = generate_advice_from_chart