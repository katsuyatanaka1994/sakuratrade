from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from schemas.indicators import IndicatorItem, TradingAnalysis
from services.frontend_gpt_analyzer import FrontendGPTAnalyzer
from services.rule_based_analyzer import RuleBasedAnalyzer


class AnalysisIntegrator:
    """ルールベース分析とGPT分析を統合するクラス"""

    def __init__(self, openai_api_key: str):
        self.rule_analyzer = RuleBasedAnalyzer()
        self.gpt_analyzer = FrontendGPTAnalyzer(openai_api_key)

    def integrate_analysis(
        self,
        bar_data: Dict[str, Any],
        indicators_data: Dict[str, Any],
        context: Dict[str, Any],
        image_base64: str,
        symbol_context: str = None,
        analysis_context: str = None,
        entry_price: float = None,
        position_type: Literal["long", "short"] = None,
    ) -> TradingAnalysis:
        """分析を統合して最終結果を生成"""

        # 1. ルールベース分析実行
        pivot_result = self.rule_analyzer.analyze_pivot_v13(bar_data)
        entry_result = self.rule_analyzer.analyze_entry_v04(bar_data, indicators_data, context)

        # 2. GPT分析実行
        gpt_result = self.gpt_analyzer.analyze_chart_image(image_base64, symbol_context, analysis_context)

        # 3. インジケーター配列を作成
        rule_indicators = []
        rule_indicators.extend(self.rule_analyzer.pivot_result_to_indicators(pivot_result))
        rule_indicators.extend(self.rule_analyzer.entry_result_to_indicators(entry_result))

        gpt_indicators = self.gpt_analyzer.gpt_result_to_indicators(gpt_result)

        # 4. 重複するインジケーターをマージ
        merged_indicators = self._merge_indicators(rule_indicators, gpt_indicators)

        # 5. 総合評価を算出
        overall_evaluation, confidence_score = self._calculate_overall_evaluation(
            pivot_result, entry_result, gpt_indicators, position_type
        )

        # 6. 戦略情報を生成
        strategy_info = self._generate_strategy_info(
            pivot_result, entry_result, gpt_result, overall_evaluation, position_type
        )

        # 7. 統合結果を返す
        return TradingAnalysis(
            timestamp=datetime.now(),
            symbol=symbol_context,
            entry_price=entry_price,
            position_type=position_type,
            indicators=merged_indicators,
            pivot_score=pivot_result.get("final"),
            entry_score=entry_result.get("final"),
            pivot_is_valid=pivot_result.get("isPivot"),
            entry_label=entry_result.get("label"),
            overall_evaluation=overall_evaluation,
            confidence_score=confidence_score,
            strategy_summary=strategy_info["summary"],
            risk_points=strategy_info["risks"],
            opportunity_points=strategy_info["opportunities"],
        )

    def _merge_indicators(
        self, rule_indicators: List[IndicatorItem], gpt_indicators: List[IndicatorItem]
    ) -> List[IndicatorItem]:
        """重複するインジケーターをマージ"""
        merged = {}

        # ルールベースのインジケーターを追加
        for indicator in rule_indicators:
            merged[indicator.name] = indicator

        # GPTのインジケーターを追加（重複チェック）
        for indicator in gpt_indicators:
            key = indicator.name

            # 重複する場合の処理（出来高等）
            if any(existing_key in key or key in existing_key for existing_key in merged.keys()):
                # より詳細なコメントに更新
                for existing_key in list(merged.keys()):
                    if existing_key in key or key in existing_key:
                        existing = merged[existing_key]
                        # 両方の情報を統合
                        combined_comment = f"{existing.comment} / GPT分析: {indicator.comment}"
                        merged[existing_key] = IndicatorItem(
                            name=existing.name,
                            value=f"Rule: {existing.value}, GPT: {indicator.value}",
                            evaluation=self._combine_evaluations(existing.evaluation, indicator.evaluation),
                            comment=combined_comment,
                            source="rule_based",  # ルールベースを優先
                            confidence=(existing.confidence + indicator.confidence) / 2,
                        )
                        break
            else:
                merged[key] = indicator

        return list(merged.values())

    def _combine_evaluations(self, eval1: str, eval2: str) -> str:
        """2つの評価を統合"""
        evaluation_scores = {"強気": 2, "やや強気": 1, "中立": 0, "やや弱気": -1, "弱気": -2}

        score1 = evaluation_scores.get(eval1, 0)
        score2 = evaluation_scores.get(eval2, 0)
        combined_score = (score1 + score2) / 2

        score_to_evaluation = {
            2: "強気",
            1.5: "強気",
            1: "やや強気",
            0.5: "やや強気",
            0: "中立",
            -0.5: "やや弱気",
            -1: "やや弱気",
            -1.5: "弱気",
            -2: "弱気",
        }

        # 最も近いスコアを探す
        closest_score = min(score_to_evaluation.keys(), key=lambda x: abs(x - combined_score))
        return score_to_evaluation[closest_score]

    def _calculate_overall_evaluation(
        self,
        pivot_result: Dict[str, Any],
        entry_result: Dict[str, Any],
        gpt_indicators: List[IndicatorItem],
        position_type: Optional[str],
    ) -> tuple[Literal["推奨", "保留", "非推奨"], float]:
        """総合評価を算出"""

        # ルールベース評価のウェイト
        pivot_score = pivot_result.get("final", 50)
        entry_score = entry_result.get("final", 50)
        entry_label = entry_result.get("label", "見送り")
        pivot_is_valid = pivot_result.get("isPivot", False)

        # GPT評価のウェイト
        gpt_positive_count = sum(1 for ind in gpt_indicators if ind.evaluation in ["強気", "やや強気"])
        gpt_negative_count = sum(1 for ind in gpt_indicators if ind.evaluation in ["弱気", "やや弱気"])
        gpt_total = len(gpt_indicators)

        # 統合スコア算出
        rule_base_score = (pivot_score + entry_score) / 2
        gpt_sentiment_score = ((gpt_positive_count - gpt_negative_count) / max(gpt_total, 1)) * 50 + 50

        # 重み付け統合（ルールベース70%, GPT30%）
        integrated_score = rule_base_score * 0.7 + gpt_sentiment_score * 0.3

        # 信頼度算出
        confidence = self._calculate_confidence(pivot_result, entry_result, gpt_indicators)

        # 最終判定ロジック
        if position_type == "long":
            if pivot_is_valid and entry_label in ["強エントリー", "エントリー可"] and integrated_score >= 70:
                return "推奨", confidence
            elif pivot_is_valid and integrated_score >= 60:
                return "保留", confidence * 0.8
            else:
                return "非推奨", confidence
        elif position_type == "short":
            # ショートの場合は逆の評価
            if integrated_score <= 40 and gpt_negative_count > gpt_positive_count:
                return "推奨", confidence
            elif integrated_score <= 50:
                return "保留", confidence * 0.8
            else:
                return "非推奨", confidence
        else:
            # ポジションタイプが不明な場合
            if integrated_score >= 70:
                return "推奨", confidence
            elif integrated_score >= 50:
                return "保留", confidence * 0.9
            else:
                return "非推奨", confidence

    def _calculate_confidence(
        self, pivot_result: Dict[str, Any], entry_result: Dict[str, Any], gpt_indicators: List[IndicatorItem]
    ) -> float:
        """信頼度を算出"""
        confidence_factors = []

        # ルールベースの信頼度（高い）
        if pivot_result and entry_result:
            confidence_factors.append(0.9)
        elif pivot_result or entry_result:
            confidence_factors.append(0.8)
        else:
            confidence_factors.append(0.5)

        # GPT分析の平均信頼度
        if gpt_indicators:
            gpt_avg_confidence = sum(ind.confidence for ind in gpt_indicators) / len(gpt_indicators)
            confidence_factors.append(gpt_avg_confidence)
        else:
            confidence_factors.append(0.3)

        # データ整合性チェック
        consistency_score = self._check_data_consistency(pivot_result, entry_result, gpt_indicators)
        confidence_factors.append(consistency_score)

        return sum(confidence_factors) / len(confidence_factors)

    def _check_data_consistency(
        self, pivot_result: Dict[str, Any], entry_result: Dict[str, Any], gpt_indicators: List[IndicatorItem]
    ) -> float:
        """データの整合性をチェック"""
        consistency_points = []

        # ルールベース内の整合性
        if pivot_result and entry_result:
            pivot_final = pivot_result.get("final", 50)
            entry_final = entry_result.get("final", 50)

            # スコアの差が大きすぎない場合は整合性あり
            score_diff = abs(pivot_final - entry_final)
            if score_diff <= 20:
                consistency_points.append(0.9)
            elif score_diff <= 40:
                consistency_points.append(0.7)
            else:
                consistency_points.append(0.5)

        # ルールベースとGPTの整合性
        rule_sentiment = self._get_rule_sentiment(pivot_result, entry_result)
        gpt_sentiment = self._get_gpt_sentiment(gpt_indicators)

        if rule_sentiment == gpt_sentiment:
            consistency_points.append(0.9)
        elif abs(rule_sentiment - gpt_sentiment) <= 1:
            consistency_points.append(0.7)
        else:
            consistency_points.append(0.4)

        return sum(consistency_points) / len(consistency_points) if consistency_points else 0.5

    def _get_rule_sentiment(self, pivot_result: Dict[str, Any], entry_result: Dict[str, Any]) -> int:
        """ルールベース分析のセンチメントを数値化 (-2 to 2)"""
        if not pivot_result and not entry_result:
            return 0

        avg_score = (pivot_result.get("final", 50) + entry_result.get("final", 50)) / 2

        if avg_score >= 80:
            return 2
        elif avg_score >= 65:
            return 1
        elif avg_score >= 50:
            return 0
        elif avg_score >= 35:
            return -1
        else:
            return -2

    def _get_gpt_sentiment(self, gpt_indicators: List[IndicatorItem]) -> int:
        """GPT分析のセンチメントを数値化 (-2 to 2)"""
        if not gpt_indicators:
            return 0

        sentiment_sum = 0
        evaluation_scores = {"強気": 2, "やや強気": 1, "中立": 0, "やや弱気": -1, "弱気": -2}

        for indicator in gpt_indicators:
            sentiment_sum += evaluation_scores.get(indicator.evaluation, 0)

        avg_sentiment = sentiment_sum / len(gpt_indicators)
        return round(avg_sentiment)

    def _generate_strategy_info(
        self,
        pivot_result: Dict[str, Any],
        entry_result: Dict[str, Any],
        gpt_result: Dict[str, Any],
        overall_evaluation: str,
        position_type: Optional[str],
    ) -> Dict[str, Any]:
        """戦略情報を生成"""

        risks = []
        opportunities = []

        # ルールベースからの情報
        if pivot_result and not pivot_result.get("isPivot", False):
            risks.append("Pivot足認定されておらず、押し目買いの信頼度が低い")

        entry_label = entry_result.get("label", "見送り") if entry_result else "見送り"
        if entry_label == "見送り":
            risks.append("エントリー条件を満たしていない")
        elif entry_label == "強エントリー":
            opportunities.append("強力なエントリーシグナルが発生")

        # GPTからの情報
        trend_info = gpt_result.get("trend", {})
        if trend_info.get("evaluation") == "強気":
            opportunities.append(f"トレンド分析: {trend_info.get('comment', 'ポジティブなトレンド')}")
        elif trend_info.get("evaluation") == "弱気":
            risks.append(f"トレンド分析: {trend_info.get('comment', 'ネガティブなトレンド')}")

        # RSI情報
        rsi_info = gpt_result.get("rsi", {})
        rsi_value = rsi_info.get("value")
        if isinstance(rsi_value, (int, float)):
            if rsi_value > 70:
                risks.append(f"RSI過熱圏（{rsi_value}）で調整リスクあり")
            elif rsi_value < 30:
                opportunities.append(f"RSI売られすぎ圏（{rsi_value}）で反発期待")

        # 戦略サマリー生成
        if overall_evaluation == "推奨":
            summary = f"{position_type or 'ロング'}ポジションに適したタイミングです。"
        elif overall_evaluation == "保留":
            summary = "もう少し様子見が適切かもしれません。"
        else:
            summary = "現在のタイミングはエントリーに適していません。"

        return {"summary": summary, "risks": risks, "opportunities": opportunities}
