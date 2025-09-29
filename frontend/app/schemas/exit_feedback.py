from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class ExitFeedbackRequest(BaseModel):
    """決済フィードバック要求"""

    trade_id: Optional[str] = Field(None, description="トレードID")
    symbol: str = Field(..., description="銘柄名・証券コード")
    entry_price: float = Field(..., description="建値")
    exit_price: float = Field(..., description="決済値")
    position_type: Literal["long", "short"] = Field(..., description="ポジションタイプ")
    quantity: int = Field(..., description="数量")
    image_file: Optional[str] = Field(None, description="チャート画像ファイル名")
    entry_date: Optional[str] = Field(None, description="エントリー日時")
    exit_date: Optional[str] = Field(None, description="決済日時")


class TradeReflectionItem(BaseModel):
    """振り返り項目"""

    category: str = Field(..., description="項目名（仕掛けタイミング、利確判断等）")
    content: str = Field(..., description="内容説明")
    evaluation: Literal["◎", "○", "△", "✕"] = Field(..., description="評価記号")
    comment: str = Field(..., description="詳細コメント")


class ExitFeedbackResponse(BaseModel):
    """決済フィードバック応答"""

    success: bool = Field(True, description="処理成功フラグ")
    trade_summary: str = Field(..., description="トレード概要")
    profit_loss: float = Field(..., description="損益金額")
    profit_loss_rate: float = Field(..., description="損益率(%)")
    reflection_items: List[TradeReflectionItem] = Field(default_factory=list, description="振り返り項目")
    memo_comment: str = Field("", description="メモ・補足コメント")
    feedback_html: str = Field("", description="HTML形式のフィードバック")
    error_message: Optional[str] = Field(None, description="エラーメッセージ")
