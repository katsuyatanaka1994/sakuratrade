import json
import os
import subprocess
from typing import Any, Dict, List

from app.schemas.indicators import IndicatorItem


class RuleBasedAnalyzer:
    """ルールベース分析（pivot1.3 / entry-v04）の処理クラス"""

    def __init__(self):
        self.pivot_path = os.path.join(os.path.dirname(__file__), "../../pivot")
        self.entry_path = os.path.join(os.path.dirname(__file__), "../../entry-v04")

    def analyze_pivot_v13(self, bar_data: Dict[str, Any]) -> Dict[str, Any]:
        """Pivot v1.3 分析を実行"""
        try:
            # Node.js経由でpivot分析実行
            cmd = [
                "node",
                "-e",
                f"""
                const {{ scorePivot }} = require('{self.pivot_path}/dist/pivotScore.js');
                const input = {json.dumps(bar_data)};
                const result = scorePivot(input);
                console.log(JSON.stringify(result));
            """,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout.strip())
        except subprocess.CalledProcessError as e:
            print(f"Pivot v1.3 analysis failed: {e}")
            return self._get_fallback_pivot_result()
        except Exception as e:
            print(f"Error in pivot analysis: {e}")
            return self._get_fallback_pivot_result()

    def analyze_entry_v04(
        self, bar_data: Dict[str, Any], indicators_data: Dict[str, Any], context: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Entry v0.4 分析を実行"""
        try:
            # Node.js経由でentry分析実行
            analysis_input = {"bar": bar_data, "indicators": indicators_data, "context": context}

            cmd = [
                "node",
                "-e",
                f"""
                const {{ scoreEntryV04 }} = require('{self.entry_path}/dist/entryScore.js');
                const input = {json.dumps(analysis_input)};
                const result = scoreEntryV04(input.bar, input.indicators, input.context);
                console.log(JSON.stringify(result));
            """,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            return json.loads(result.stdout.strip())
        except subprocess.CalledProcessError as e:
            print(f"Entry v0.4 analysis failed: {e}")
            return self._get_fallback_entry_result()
        except Exception as e:
            print(f"Error in entry analysis: {e}")
            return self._get_fallback_entry_result()

    def pivot_result_to_indicators(self, pivot_result: Dict[str, Any]) -> List[IndicatorItem]:
        """Pivot分析結果をIndicatorItem形式に変換"""
        indicators = []

        if not pivot_result:
            return indicators

        # ローソク足評価
        candle_score = pivot_result.get("scores", {}).get("candle", 0)
        candle_evaluation = self._score_to_evaluation(candle_score)
        indicators.append(
            IndicatorItem(
                name="ローソク足パターン",
                value=candle_score,
                evaluation=candle_evaluation,
                comment=f"Pivot足判定でのローソク足スコア: {candle_score}点。{self._get_candle_comment(candle_score)}",
                source="rule_based",
                confidence=0.95,
            )
        )

        # 移動平均線ロケーション
        location_score = pivot_result.get("scores", {}).get("location", 0)
        location_evaluation = self._score_to_evaluation(location_score)
        meta = pivot_result.get("meta", {})
        near_info = "20MA近接" if meta.get("near20") else ""
        near_info += "&60MA近接" if meta.get("near60") else ""
        if not near_info:
            near_info = "MA非近接"

        indicators.append(
            IndicatorItem(
                name="移動平均線位置",
                value=f"{location_score}点 ({near_info})",
                evaluation=location_evaluation,
                comment=f"株価と移動平均線の位置関係: {near_info}。スコア{location_score}点。",
                source="rule_based",
                confidence=0.90,
            )
        )

        # 移動平均線傾き
        slope_score = pivot_result.get("scores", {}).get("slope", 0)
        slope_evaluation = self._score_to_evaluation(slope_score)
        slope20_pct = meta.get("slope20pct", 0)
        slope60_pct = meta.get("slope60pct", 0)

        indicators.append(
            IndicatorItem(
                name="移動平均線傾き",
                value=f"20MA: {slope20_pct:+.2f}%, 60MA: {slope60_pct:+.2f}%",
                evaluation=slope_evaluation,
                comment=(
                    f"移動平均線の傾き評価。20MA: {slope20_pct:+.2f}%, 60MA: {slope60_pct:+.2f}%。"
                    f"スコア{slope_score}点。"
                ),
                source="rule_based",
                confidence=0.85,
            )
        )

        # 出来高
        volume_score = pivot_result.get("scores", {}).get("volume", 0)
        volume_evaluation = self._score_to_evaluation(volume_score)
        indicators.append(
            IndicatorItem(
                name="出来高",
                value=f"{volume_score}点",
                evaluation=volume_evaluation,
                comment=f"5日平均出来高との比較による評価: {volume_score}点。{self._get_volume_comment(volume_score)}",
                source="rule_based",
                confidence=0.80,
            )
        )

        return indicators

    def entry_result_to_indicators(self, entry_result: Dict[str, Any]) -> List[IndicatorItem]:
        """Entry分析結果をIndicatorItem形式に変換"""
        indicators = []

        if not entry_result:
            return indicators

        # エントリー総合判定
        final_score = entry_result.get("final", 0)
        label = entry_result.get("label", "見送り")
        gate_passed = entry_result.get("gatePassed", False)

        evaluation_map = {"強エントリー": "強気", "エントリー可": "やや強気", "見送り": "弱気"}

        indicators.append(
            IndicatorItem(
                name="エントリー判定",
                value=f"{label} ({final_score}点)",
                evaluation=evaluation_map.get(label, "中立"),
                comment=(
                    f"Entry v0.4による総合判定: {label}。最終スコア{final_score}点、"
                    f"ゲート通過: {'○' if gate_passed else '×'}"
                ),
                source="rule_based",
                confidence=0.90,
            )
        )

        # MA詳細評価
        ma_score = entry_result.get("scores", {}).get("MA", 0)
        ma_evaluation = self._score_to_evaluation(ma_score)
        indicators.append(
            IndicatorItem(
                name="移動平均線分析（Entry）",
                value=f"{ma_score}点",
                evaluation=ma_evaluation,
                comment=f"Entry判定における移動平均線評価: {ma_score}点。5MA/20MA/60MAの並びと傾きを総合評価。",
                source="rule_based",
                confidence=0.85,
            )
        )

        return indicators

    def _score_to_evaluation(self, score: float) -> str:
        """スコアを5段階評価に変換"""
        if score >= 80:
            return "強気"
        elif score >= 65:
            return "やや強気"
        elif score >= 50:
            return "中立"
        elif score >= 35:
            return "やや弱気"
        else:
            return "弱気"

    def _get_candle_comment(self, score: float) -> str:
        """ローソク足スコアに基づくコメント"""
        if score >= 85:
            return "理想的なローソク足パターンです"
        elif score >= 70:
            return "良好なローソク足パターンです"
        elif score >= 50:
            return "普通のローソク足パターンです"
        else:
            return "弱いローソク足パターンです"

    def _get_volume_comment(self, score: float) -> str:
        """出来高スコアに基づくコメント"""
        if score >= 80:
            return "活発な出来高です"
        elif score >= 60:
            return "やや活発な出来高です"
        elif score >= 40:
            return "普通の出来高です"
        else:
            return "出来高が少ないです"

    def _get_fallback_pivot_result(self) -> Dict[str, Any]:
        """Pivot分析エラー時のフォールバック結果"""
        return {
            "scores": {"candle": 50, "location": 50, "slope": 50, "volume": 50},
            "weighted": {"candle": 20, "location": 15, "slope": 10, "volume": 5},
            "final": 50,
            "isPivot": False,
            "meta": {"near20": False, "near60": False, "slope20pct": 0, "slope60pct": 0},
        }

    def _get_fallback_entry_result(self) -> Dict[str, Any]:
        """Entry分析エラー時のフォールバック結果"""
        return {"final": 50, "label": "見送り", "gatePassed": False, "scores": {"MA": 50, "Candle": 50, "Volume": 50}}
