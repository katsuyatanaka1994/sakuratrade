from pydantic import BaseModel, Field
from typing import List, Optional, Literal, Union
from datetime import datetime

class IndicatorItem(BaseModel):
    """個別のインジケーター項目"""
    name: str = Field(..., description="インジケーター名（例：RSI, 移動平均線, 出来高）")
    value: Union[str, float, int] = Field(..., description="数値または状態文字列")
    evaluation: Literal["強気", "やや強気", "中立", "やや弱気", "弱気"] = Field(..., description="5段階評価")
    comment: str = Field(..., description="詳細な説明・解釈")
    source: Literal["rule_based", "gpt_analysis"] = Field(..., description="データソース")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="信頼度（0-1）")

class TradingAnalysis(BaseModel):
    """トレード分析結果の統合データ"""
    timestamp: datetime = Field(default_factory=datetime.now, description="分析実行時刻")
    symbol: Optional[str] = Field(None, description="銘柄名・証券コード")
    entry_price: Optional[float] = Field(None, description="建値")
    position_type: Optional[Literal["long", "short"]] = Field(None, description="ポジションタイプ")
    
    # 統合インジケーター配列
    indicators: List[IndicatorItem] = Field(default_factory=list, description="構造化インジケーター配列")
    
    # ルールベース判定結果
    pivot_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Pivot足判定スコア")
    entry_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Entry足判定スコア")
    pivot_is_valid: Optional[bool] = Field(None, description="Pivot認定フラグ")
    entry_label: Optional[Literal["強エントリー", "エントリー可", "見送り"]] = Field(None, description="エントリー判定ラベル")
    
    # 総合判断
    overall_evaluation: Literal["推奨", "保留", "非推奨"] = Field(..., description="総合判断")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="総合信頼度")
    
    # 戦略情報
    strategy_summary: Optional[str] = Field(None, description="戦略概要")
    risk_points: List[str] = Field(default_factory=list, description="注意点・リスク")
    opportunity_points: List[str] = Field(default_factory=list, description="チャンスポイント")

class AnalysisRequest(BaseModel):
    """分析リクエストの入力データ"""
    symbol: Optional[str] = None
    entry_price: Optional[float] = None
    position_type: Optional[Literal["long", "short"]] = None
    chart_analysis_context: Optional[str] = None
    
class AnalysisResponse(BaseModel):
    """分析レスポンス"""
    success: bool = Field(..., description="処理成功フラグ")
    analysis: Optional[TradingAnalysis] = Field(None, description="分析結果")
    natural_feedback: str = Field(..., description="自然言語フィードバック")
    error_message: Optional[str] = Field(None, description="エラーメッセージ")