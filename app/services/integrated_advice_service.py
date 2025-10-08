import base64
import logging
import os
from typing import Any, Dict, Literal, Optional

from jinja2 import Template

from app.schemas.indicators import AnalysisResponse, IndicatorItem, TradingAnalysis
from app.services.analysis_integrator import AnalysisIntegrator

logger = logging.getLogger(__name__)


class IntegratedAdviceService:
    """統合分析サービス"""

    def __init__(self, openai_api_key: str):
        self.integrator = AnalysisIntegrator(openai_api_key)
        self.template = self._load_template()

    def _load_template(self) -> Template:
        """テンプレートを読み込み"""
        try:
            template_path = os.path.join(os.path.dirname(__file__), "../templates/integrated_analysis.j2")
            with open(template_path, "r", encoding="utf-8") as f:
                return Template(f.read())
        except Exception as e:
            logger.error(f"Failed to load template: {e}")
            # フォールバックテンプレート
            return Template("""
## {{ analysis.overall_evaluation }}
{{ analysis.strategy_summary }}

### テクニカル指標
{% for indicator in analysis.indicators %}
- {{ indicator.name }}: {{ indicator.value }} ({{ indicator.evaluation }})
{% endfor %}
            """)

    async def generate_integrated_advice(
        self,
        image_data: bytes,
        filename: str,
        symbol_context: Optional[str] = None,
        analysis_context: Optional[str] = None,
        entry_price: Optional[float] = None,
        position_type: Optional[Literal["long", "short"]] = None,
    ) -> AnalysisResponse:
        """統合分析によるアドバイス生成"""

        try:
            # 1. 画像をBase64エンコード
            image_base64 = base64.b64encode(image_data).decode("utf-8")

            # 2. サンプルバーデータを作成（実際の実装では画像から抽出するか外部から取得）
            bar_data = self._create_sample_bar_data()
            indicators_data = self._create_sample_indicators_data()
            context = self._create_analysis_context(entry_price, position_type)

            # 3. 統合分析実行
            analysis = self.integrator.integrate_analysis(
                bar_data=bar_data,
                indicators_data=indicators_data,
                context=context,
                image_base64=image_base64,
                symbol_context=symbol_context,
                analysis_context=analysis_context,
                entry_price=entry_price,
                position_type=position_type,
            )

            # 4. 自然言語フィードバック生成
            natural_feedback = self.template.render(analysis=analysis)

            return AnalysisResponse(success=True, analysis=analysis, natural_feedback=natural_feedback)

        except Exception as e:
            logger.error(f"Integrated analysis failed: {e}")
            fallback_analysis = self._build_fallback_analysis(symbol_context, entry_price, position_type)
            return AnalysisResponse(
                success=True,
                analysis=fallback_analysis,
                natural_feedback=f"分析モジュールでエラーが発生したためフォールバック結果を返します: {str(e)}",
                error_message=str(e),
            )

    def _create_sample_bar_data(self) -> Dict[str, Any]:
        """サンプルバーデータ（実際の実装では画像から抽出またはAPI取得）"""
        return {
            "date": "2024-01-15",
            "open": 1000,
            "high": 1120,
            "low": 980,
            "close": 1110,
            "volume": 150000,
            "volMA5": 100000,
            "sma20": 1000,
            "sma60": 950,
            "sma20_5ago": 980,
            "sma60_5ago": 940,
        }

    def _create_sample_indicators_data(self) -> Dict[str, Any]:
        """サンプルインジケーターデータ"""
        return {
            "sma5": 1050,
            "sma20": 1000,
            "sma60": 950,
            "sma5_5ago": 1030,
            "sma20_5ago": 980,
            "sma60_5ago": 940,
            "volMA5": 100000,
            "prevHigh": 1070,
            "prevLow": 970,
            "prevClose": 1020,
        }

    def _create_analysis_context(
        self, entry_price: Optional[float], position_type: Optional[Literal["long", "short"]]
    ) -> Dict[str, Any]:
        """分析コンテキスト作成"""
        context = {
            "recentPivotBarsAgo": 2,  # サンプル値
            "priceBand": "mid",
        }

        if entry_price:
            context["entry_price"] = entry_price

        if position_type:
            context["position_type"] = position_type

        return context

    def _build_fallback_analysis(
        self,
        symbol_context: Optional[str],
        entry_price: Optional[float],
        position_type: Optional[Literal["long", "short"]],
    ) -> TradingAnalysis:
        """Generate a conservative fallback TradingAnalysis when GPTやルール連携に失敗した場合"""

        indicator = IndicatorItem(
            name="簡易トレンド",
            value="上昇傾向",
            evaluation="中立",
            comment="詳細分析に失敗したためサンプル評価を返しています",
            source="gpt_analysis",
            confidence=0.3,
        )

        return TradingAnalysis(
            symbol=symbol_context,
            entry_price=entry_price,
            position_type=position_type,
            indicators=[indicator],
            pivot_score=50.0,
            entry_score=50.0,
            pivot_is_valid=False,
            entry_label="見送り",
            overall_evaluation="保留",
            confidence_score=0.3,
            strategy_summary="フォールバック分析: 追加の確認が必要です",
            risk_points=["詳細な統合分析を実行できませんでした"],
            opportunity_points=["簡易評価では大きなトレンド変化は検出されていません"],
        )


# 従来のシンプルなアドバイス生成（後方互換性のため）
def generate_simple_advice(image_base64: str, symbol_context: str = None, analysis_context: str = None) -> str:
    """シンプルなGPT分析（統合分析を使わない場合）"""

    _system_prompt = (
        "あなたはプロの株式スイングトレーダー兼アナリストです。"
        "チャート画像を解析し、トレーディングアドバイスを日本語で提供してください。"
    )

    _user_prompt = (
        f"この{symbol_context or '株価'}のチャート画像を解析し、"
        f"{analysis_context or 'トレーディング'}のアドバイスを教えてください。"
    )

    # 簡易版のGPT呼び出し（実装は省略）
    return f"📊 **{symbol_context or 'チャート'}分析**\n\n簡易分析モードで実行されました。"
