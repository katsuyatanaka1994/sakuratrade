from schemas.indicator_facts import IndicatorFacts
def estimate_strategy(indicators: IndicatorFacts) -> dict:

    # None対策でデフォルト値を設定
    trend = indicators.trend_check or ""
    rsi = indicators.rsi_overheat or ""
    current_price = indicators.current_price or 0
    recent_high = indicators.recent_high or 0
    recent_low = indicators.recent_low or 0
    price_action = indicators.price_action or ""
    volume = indicators.volume_trend or ""
    sma_touch = indicators.sma_touch if indicators.sma_touch is not None else False

    if "下降トレンド" in trend and "RSI高値圏" in rsi and price_action == "陰線" and volume == "増加":
        return {
            "entry_recommendation": "戻り売りのチャンス。5MAタッチからの陰線＋出来高増でショート狙い。",
            "take_profit_point": f"第一目標は前回安値（例：{recent_low}）",
            "stop_loss_point": f"直近戻り高値（例：{recent_high}）を明確に上抜けたら損切り",
            "tactical_summary": [
                "✅ 5MAタッチからの陰線1本目を待つ",
                "✅ RSI・出来高・ローソク足の「型」が揃ったら即準備",
                "✅ すでに利確済みなので、焦らず再現性を取りにいくフェーズ"
            ],
            "pattern_name": "下降トレンド・戻り売り型",
            "pattern_score": 0.9
        }

    if "上昇トレンド" in trend and rsi == "RSI上昇中" and price_action == "陽線" and volume == "増加":
        return {
            "entry_recommendation": "押し目買いの初動。ただし型未完成で様子見も視野。",
            "take_profit_point": f"前回高値（例：{recent_high}）を視野",
            "stop_loss_point": f"直近安値（例：{recent_low}）を割ったら損切り",
            "tactical_summary": [
                "🧠 今できること：押し目パターン出現待ち",
                "✅ RSI50超え＆出来高伴う陽線でロング判断",
                "🔍 今は型未完成なので見送りもOK"
            ],
            "pattern_name": "上昇トレンド・押し目買い型（未完成）",
            "pattern_score": 0.6
        }

    return {
        "entry_recommendation": "トレンド不明確。次の足で明確な方向性を確認したい。",
        "take_profit_point": "",
        "stop_loss_point": "",
        "tactical_summary": [
            "👀 次のローソク足で型が出るかを確認",
            "📉 出来高・RSI・足型が揃わないと様子見推奨",
        ],
        "pattern_name": "型なし・様子見",
        "pattern_score": 0.2
    }