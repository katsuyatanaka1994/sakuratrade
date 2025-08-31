import pytest
import os
import json
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime

# テスト対象のモジュール
from schemas.indicators import IndicatorItem, TradingAnalysis, AnalysisRequest, AnalysisResponse
from services.rule_based_analyzer import RuleBasedAnalyzer
from services.gpt_analyzer import GPTAnalyzer
from services.analysis_integrator import AnalysisIntegrator
from services.integrated_advice_service import IntegratedAdviceService

class TestIndicatorSchemas:
    """インジケータースキーマのテスト"""
    
    def test_indicator_item_creation(self):
        """IndicatorItemの作成テスト"""
        indicator = IndicatorItem(
            name="RSI",
            value=65,
            evaluation="やや強気",
            comment="RSI 65、上昇トレンド継続中",
            source="gpt_analysis",
            confidence=0.8
        )
        
        assert indicator.name == "RSI"
        assert indicator.value == 65
        assert indicator.evaluation == "やや強気"
        assert indicator.source == "gpt_analysis"
        assert indicator.confidence == 0.8
    
    def test_trading_analysis_creation(self):
        """TradingAnalysisの作成テスト"""
        indicators = [
            IndicatorItem(
                name="Test Indicator",
                value="Test Value", 
                evaluation="中立",
                comment="Test Comment",
                source="rule_based"
            )
        ]
        
        analysis = TradingAnalysis(
            symbol="1234",
            entry_price=1000.0,
            position_type="long",
            indicators=indicators,
            overall_evaluation="推奨",
            confidence_score=0.85,
            strategy_summary="テスト戦略"
        )
        
        assert analysis.symbol == "1234"
        assert analysis.entry_price == 1000.0
        assert analysis.position_type == "long"
        assert len(analysis.indicators) == 1
        assert analysis.overall_evaluation == "推奨"

class TestRuleBasedAnalyzer:
    """ルールベースアナライザーのテスト"""
    
    @pytest.fixture
    def analyzer(self):
        return RuleBasedAnalyzer()
    
    @pytest.fixture
    def sample_bar_data(self):
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
            "sma60_5ago": 940
        }
    
    def test_score_to_evaluation_conversion(self, analyzer):
        """スコア→評価変換のテスト"""
        assert analyzer._score_to_evaluation(85) == "強気"
        assert analyzer._score_to_evaluation(70) == "やや強気"
        assert analyzer._score_to_evaluation(55) == "中立"
        assert analyzer._score_to_evaluation(40) == "やや弱気"
        assert analyzer._score_to_evaluation(20) == "弱気"
    
    @patch('subprocess.run')
    def test_analyze_pivot_v13_success(self, mock_subprocess, analyzer, sample_bar_data):
        """Pivot v1.3分析成功のテスト"""
        # subprocess.runのモック設定
        mock_result = Mock()
        mock_result.stdout = json.dumps({
            'scores': {'candle': 80, 'location': 70, 'slope': 60, 'volume': 90},
            'final': 75,
            'isPivot': True,
            'meta': {'near20': True, 'near60': False, 'slope20pct': 1.5, 'slope60pct': 0.8}
        })
        mock_subprocess.return_value = mock_result
        
        result = analyzer.analyze_pivot_v13(sample_bar_data)
        
        assert 'scores' in result
        assert result['final'] == 75
        assert result['isPivot'] == True
    
    @patch('subprocess.run')
    def test_analyze_pivot_v13_failure(self, mock_subprocess, analyzer, sample_bar_data):
        """Pivot v1.3分析失敗のテスト"""
        mock_subprocess.side_effect = Exception("Node.js error")
        
        result = analyzer.analyze_pivot_v13(sample_bar_data)
        
        # フォールバック結果が返されることを確認
        assert 'scores' in result
        assert result['final'] == 50
        assert result['isPivot'] == False
    
    def test_pivot_result_to_indicators(self, analyzer):
        """Pivot結果→インジケーター変換のテスト"""
        pivot_result = {
            'scores': {'candle': 80, 'location': 70, 'slope': 60, 'volume': 90},
            'meta': {'near20': True, 'near60': False, 'slope20pct': 1.5, 'slope60pct': 0.8}
        }
        
        indicators = analyzer.pivot_result_to_indicators(pivot_result)
        
        assert len(indicators) == 4  # candle, location, slope, volume
        assert all(isinstance(ind, IndicatorItem) for ind in indicators)
        assert any(ind.name == "ローソク足パターン" for ind in indicators)

class TestGPTAnalyzer:
    """GPTアナライザーのテスト"""
    
    @pytest.fixture
    def analyzer(self):
        return GPTAnalyzer("test_api_key")
    
    def test_extract_json_from_response(self, analyzer):
        """GPT応答からJSON抽出のテスト"""
        response_text = '''
        以下が分析結果です：
        ```json
        {
          "rsi": {"value": 65, "evaluation": "やや強気", "comment": "上昇中"},
          "trend": {"value": "上昇トレンド", "evaluation": "強気", "comment": "継続中"}
        }
        ```
        '''
        
        result = analyzer._extract_json_from_response(response_text)
        
        assert 'rsi' in result
        assert 'trend' in result
        assert result['rsi']['value'] == 65
    
    def test_parse_natural_text(self, analyzer):
        """自然文解析のテスト"""
        text = "RSI は 75 で上昇トレンドが継続しています"
        
        result = analyzer._parse_natural_text(text)
        
        assert 'rsi' in result
        assert result['rsi']['value'] == 75
        assert 'trend' in result
    
    def test_gpt_result_to_indicators(self, analyzer):
        """GPT結果→インジケーター変換のテスト"""
        gpt_result = {
            'rsi': {'value': 65, 'evaluation': 'やや強気', 'comment': 'RSI上昇中'},
            'macd': {'value': 'ゴールデンクロス', 'evaluation': '強気', 'comment': 'MACD好転'},
            'trend': {'value': '上昇トレンド', 'evaluation': '強気', 'comment': 'トレンド継続'}
        }
        
        indicators = analyzer.gpt_result_to_indicators(gpt_result)
        
        assert len(indicators) == 3
        assert all(isinstance(ind, IndicatorItem) for ind in indicators)
        assert all(ind.source == "gpt_analysis" for ind in indicators)

class TestAnalysisIntegrator:
    """分析統合器のテスト"""
    
    @pytest.fixture
    def integrator(self):
        return AnalysisIntegrator("test_api_key")
    
    def test_combine_evaluations(self, integrator):
        """評価統合のテスト"""
        assert integrator._combine_evaluations("強気", "やや強気") == "強気"
        assert integrator._combine_evaluations("中立", "やや弱気") == "やや弱気" 
        assert integrator._combine_evaluations("強気", "弱気") == "中立"
    
    def test_get_rule_sentiment(self, integrator):
        """ルールベースセンチメント取得のテスト"""
        pivot_result = {"final": 85}
        entry_result = {"final": 80}
        
        sentiment = integrator._get_rule_sentiment(pivot_result, entry_result)
        
        assert sentiment == 2  # 強気
    
    def test_get_gpt_sentiment(self, integrator):
        """GPTセンチメント取得のテスト"""
        indicators = [
            IndicatorItem(name="Test1", value="test", evaluation="強気", comment="test", source="gpt_analysis"),
            IndicatorItem(name="Test2", value="test", evaluation="やや弱気", comment="test", source="gpt_analysis"),
            IndicatorItem(name="Test3", value="test", evaluation="中立", comment="test", source="gpt_analysis")
        ]
        
        sentiment = integrator._get_gpt_sentiment(indicators)
        
        assert sentiment == 0  # (2 + (-1) + 0) / 3 = 0.33 → 0
    
    def test_merge_indicators(self, integrator):
        """インジケーターマージのテスト"""
        rule_indicators = [
            IndicatorItem(name="出来高", value="100点", evaluation="強気", comment="ルール判定", source="rule_based")
        ]
        gpt_indicators = [
            IndicatorItem(name="出来高傾向（GPT）", value="増加", evaluation="やや強気", comment="GPT判定", source="gpt_analysis"),
            IndicatorItem(name="RSI", value=65, evaluation="やや強気", comment="RSI分析", source="gpt_analysis")
        ]
        
        merged = integrator._merge_indicators(rule_indicators, gpt_indicators)
        
        # 出来高系が統合され、RSIは独立して存在
        assert len(merged) == 2
        assert any("出来高" in ind.name for ind in merged)
        assert any("RSI" in ind.name for ind in merged)

class TestIntegratedAdviceService:
    """統合アドバイスサービスのテスト"""
    
    @pytest.fixture
    def service(self):
        return IntegratedAdviceService("test_api_key")
    
    def test_create_sample_bar_data(self, service):
        """サンプルバーデータ作成のテスト"""
        bar_data = service._create_sample_bar_data()
        
        assert 'date' in bar_data
        assert 'open' in bar_data
        assert 'high' in bar_data
        assert 'low' in bar_data
        assert 'close' in bar_data
        assert 'volume' in bar_data
    
    def test_create_analysis_context(self, service):
        """分析コンテキスト作成のテスト"""
        context = service._create_analysis_context(1000.0, "long")
        
        assert context['entry_price'] == 1000.0
        assert context['position_type'] == "long"
        assert 'recentPivotBarsAgo' in context

# テスト実行用の設定
if __name__ == "__main__":
    pytest.main([__file__, "-v"])