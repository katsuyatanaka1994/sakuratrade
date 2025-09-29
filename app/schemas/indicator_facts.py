from typing import Optional

from pydantic import BaseModel, Field


class IndicatorFacts(BaseModel):
    symbol: Optional[str] = None
    trend_check: Optional[str] = Field(
        None, description="トレンドの状態", pattern="^(上昇トレンド|下降トレンド|レンジ)$"
    )
    resistance_check: Optional[str] = None
    ma_break_check: Optional[str] = None
    rsi_check: Optional[str] = None
    volume_check: Optional[str] = None
    overall_assessment: Optional[str] = None
    scenario: Optional[str] = None
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    target1: Optional[float] = None
    target2: Optional[float] = None
    trailing_strategy: Optional[str] = None
    caution1: Optional[str] = None
    caution2: Optional[str] = None
    long_judgement: Optional[str] = None
    short_judgement: Optional[str] = None
    final_comment: Optional[str] = None
    rsi_value: Optional[float] = Field(None, ge=0, le=100, description="RSI値（0〜100）")
    rsi_overheat: Optional[str] = None
    sma_touch: Optional[bool] = Field(None, description="5MAにタッチしているか")
    price_action: Optional[str] = Field(None, pattern="^(陽線|陰線|コマ)$")
    volume_trend: Optional[str] = Field(None, pattern="^(増加|減少|横ばい)$")
    recent_high: Optional[float] = None
    recent_low: Optional[float] = None
    current_price: Optional[float] = None
