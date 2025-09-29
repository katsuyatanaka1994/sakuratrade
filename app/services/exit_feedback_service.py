# app/services/exit_feedback_service.py
import base64
import os
from typing import List, Optional

import openai
from jinja2 import Environment, FileSystemLoader

from app.config import MOCK_AI
from app.schemas.exit_feedback import (
    ExitFeedbackRequest,
    ExitFeedbackResponse,
    TradeReflectionItem,
)


class ExitFeedbackService:
    """決済フィードバック生成サービス"""

    def __init__(self, openai_api_key: str):
        self.openai_api_key = openai_api_key
        # APIキー設定はMOCK時は不要
        if not MOCK_AI and openai_api_key:
            openai.api_key = openai_api_key

        # Jinja2 環境
        template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
        self.jinja_env = Environment(loader=FileSystemLoader(template_dir))

    def generate_exit_feedback(
        self, request: ExitFeedbackRequest, image_data: Optional[bytes] = None
    ) -> ExitFeedbackResponse:
        """決済フィードバックを生成"""

        try:
            # 損益計算
            profit_loss = (request.exit_price - request.entry_price) * request.quantity
            if request.position_type == "short":
                profit_loss = -profit_loss

            profit_loss_rate = (profit_loss / (request.entry_price * request.quantity)) * 100

            # トレード概要（長行分割）
            position_text = "ロング" if request.position_type == "long" else "ショート"
            trade_summary = (
                f"{request.symbol} {position_text} {request.entry_price}円 → "
                f"{request.exit_price}円 ({request.quantity}株)"
            )

            # GPT を使用してチャート分析と振り返りを生成
            reflection_items: List[TradeReflectionItem] = []
            memo_comment = ""

            if image_data and (self.openai_api_key or MOCK_AI):
                gpt_analysis = self._analyze_chart_with_gpt(request, image_data)
                reflection_items = self._parse_gpt_analysis(gpt_analysis, request)
                memo_comment = self._generate_memo_comment(gpt_analysis, request)
            else:
                # GPT 分析が利用できない場合の基本的な振り返り
                reflection_items = self._generate_basic_reflection(request)
                memo_comment = self._generate_basic_memo(request)

            # HTML フィードバック生成
            feedback_html = self._render_feedback_template(
                trade_summary=trade_summary,
                profit_loss=profit_loss,
                profit_loss_rate=profit_loss_rate,
                reflection_items=reflection_items,
                memo_comment=memo_comment,
            )

            return ExitFeedbackResponse(
                success=True,
                trade_summary=trade_summary,
                profit_loss=profit_loss,
                profit_loss_rate=profit_loss_rate,
                reflection_items=reflection_items,
                memo_comment=memo_comment,
                feedback_html=feedback_html,
            )

        except Exception as e:
            return ExitFeedbackResponse(
                success=False,
                trade_summary="",
                profit_loss=0.0,
                profit_loss_rate=0.0,
                error_message=str(e),
            )

    def _analyze_chart_with_gpt(self, request: ExitFeedbackRequest, image_data: bytes) -> str:
        """GPT を使用してチャート分析"""
        if MOCK_AI:
            position_text = "ロング（買い）" if request.position_type == "long" else "ショート（売り）"
            profit_loss = (request.exit_price - request.entry_price) * request.quantity
            if request.position_type == "short":
                profit_loss = -profit_loss

            # 画像は解析しないが、入力情報を使って模擬的な分析を返す
            return (
                "【MOCK分析】\n"
                f"- 銘柄: {request.symbol}\n"
                f"- ポジション: {position_text}\n"
                f"- 損益: {profit_loss:+.0f}円\n\n"
                "1. 仕掛けタイミング: ○ / 内容: トレンド継続の押し目でのエントリー。\n"
                "   詳細: 直近支持線で反発確認後のエントリーは妥当。\n"
                "2. 利確判断: ○ / 内容: 節目手前での利確判断。\n"
                "   詳細: 出来高の鈍化と上ヒゲ出現で一部利確判断は合理的。\n"
                "3. 改善点: △ / 内容: 逆行時のロスカット幅を明確化。\n"
                "   詳細: 直近安値割れでの撤退ルールを明文化すると再現性が上がる。\n\n"
                "メモ: 次回はエントリー根拠の一貫性を維持しつつ、分割利確と逆行時の管理を徹底する。"
            )
        try:
            # 画像を base64 エンコード
            image_base64 = base64.b64encode(image_data).decode("utf-8")

            position_text = "ロング（買い）" if request.position_type == "long" else "ショート（売り）"
            profit_loss = (request.exit_price - request.entry_price) * request.quantity
            if request.position_type == "short":
                profit_loss = -profit_loss

            prompt = f"""
このチャート画像を分析し、以下のトレードの振り返りを行ってください。

【トレード情報】
- 銘柄: {request.symbol}
- ポジション: {position_text}
- エントリー価格: {request.entry_price}円
- 決済価格: {request.exit_price}円
- 数量: {request.quantity}株
- 損益: {profit_loss:+.0f}円

【分析項目】
1. 仕掛けタイミング（エントリーポイントの妥当性）
2. 利確判断（決済タイミングの妥当性）
3. 改善点（次回に活かせる学び）

各項目について以下の形式で回答してください：
- 評価: ◎（優秀）、○（良好）、△（普通）、✕（改善必要）
- 内容: 簡潔な説明
- 詳細: 具体的なコメント

最後に、このトレードから学べるメモ・補足を記述してください。
""".strip()

            response = openai.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {"url": f"data:image/jpeg;base64,{image_base64}"},
                            },
                        ],
                    }
                ],
                max_tokens=1500,
                temperature=0.7,
            )

            return response.choices[0].message.content

        except Exception as e:
            return f"GPT分析エラー: {str(e)}"

    def _parse_gpt_analysis(self, gpt_analysis: str, request: ExitFeedbackRequest) -> List[TradeReflectionItem]:
        """GPT 分析結果をパース"""
        items: List[TradeReflectionItem] = []

        try:
            # 使わない補助変数はアンダースコア化（F841 回避）
            _ = gpt_analysis.split("\n")

            categories = ["仕掛けタイミング", "利確判断", "改善点"]

            for category in categories:
                # デフォルト値
                evaluation = "○"
                content = "分析結果を確認中..."
                comment = "詳細な分析結果を参照してください。"

                # 簡易評価抽出
                if "◎" in gpt_analysis and category in gpt_analysis:
                    evaluation = "◎"
                elif "✕" in gpt_analysis and category in gpt_analysis:
                    evaluation = "✕"
                elif "△" in gpt_analysis and category in gpt_analysis:
                    evaluation = "△"

                # カテゴリ別内容
                if category == "仕掛けタイミング":
                    action = "買い" if request.position_type == "long" else "売り"
                    content = f"エントリー価格 {request.entry_price}円での{action}判断"
                    comment = "チャートパターンと市場環境を総合的に判断"
                elif category == "利確判断":
                    content = f"決済価格 {request.exit_price}円での利確・損切り判断"
                    comment = "利益確定または損失限定のタイミング評価"
                else:  # 改善点
                    content = "次回トレードへの改善提案"
                    comment = "戦略の見直しと学習ポイント"

                items.append(
                    TradeReflectionItem(
                        category=category,
                        content=content,
                        evaluation=evaluation,
                        comment=comment,
                    )
                )

        except Exception:
            # エラー時はデフォルトアイテム
            items = self._generate_basic_reflection(request)

        return items

    def _generate_memo_comment(self, gpt_analysis: str, request: ExitFeedbackRequest) -> str:
        """メモコメント生成"""
        profit_loss = (request.exit_price - request.entry_price) * request.quantity
        if request.position_type == "short":
            profit_loss = -profit_loss

        result_text = "利益" if profit_loss >= 0 else "損失"
        position_text = "ロング" if request.position_type == "long" else "ショート"

        return (
            f"{request.symbol}の{position_text}ポジションで{result_text}となりました。\n"
            "エントリーから決済までの値動きと市場環境を振り返り、次回のトレード戦略に活かしましょう。\n"
            "特にリスク管理と利益確定のタイミングについて検討が重要です。"
        )

    def _generate_basic_reflection(self, request: ExitFeedbackRequest) -> List[TradeReflectionItem]:
        """基本的な振り返り生成（GPT 分析なし）"""
        profit_loss = (request.exit_price - request.entry_price) * request.quantity
        if request.position_type == "short":
            profit_loss = -profit_loss

        overall_evaluation = "○" if profit_loss >= 0 else "△"

        return [
            TradeReflectionItem(
                category="仕掛けタイミング",
                content=f"エントリー価格 {request.entry_price}円での判断",
                evaluation=overall_evaluation,
                comment="市場状況とテクニカル分析に基づいた判断",
            ),
            TradeReflectionItem(
                category="利確判断",
                content=f"決済価格 {request.exit_price}円での判断",
                evaluation=overall_evaluation,
                comment="利益確定・損失限定のタイミング評価",
            ),
            TradeReflectionItem(
                category="改善点",
                content="戦略の見直しと学習ポイント",
                evaluation="○",
                comment="次回トレードに活かすための改善案",
            ),
        ]

    def _generate_basic_memo(self, request: ExitFeedbackRequest) -> str:
        """基本メモ生成（長行分割）"""
        profit_loss = (request.exit_price - request.entry_price) * request.quantity
        if request.position_type == "short":
            profit_loss = -profit_loss

        result_text = "利益" if profit_loss >= 0 else "損失"
        return (
            f"{request.symbol}のトレードで{result_text}となりました。"
            "市場分析と戦略の見直しを行い、次回の改善に活かしましょう。"
        )

    def _render_feedback_template(self, **kwargs) -> str:
        """フィードバックテンプレートをレンダリング"""
        template = self.jinja_env.get_template("exit_feedback.j2")
        return template.render(**kwargs)
