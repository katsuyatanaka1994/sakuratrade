import re
import json
import openai
from typing import List, Dict, Any, Optional
from schemas.indicators import IndicatorItem

class GPTAnalyzer:
    """GPT-4o による画像解析とテクニカル指標抽出クラス"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        openai.api_key = api_key
    
    def analyze_chart_image(self, image_base64: str, symbol_context: str = None, analysis_context: str = None) -> Dict[str, Any]:
        """チャート画像を解析し、構造化データを抽出"""
        
        system_prompt = """
あなたはプロの株式アナリストです。チャート画像から以下のテクニカル指標を抽出し、JSON形式で返してください。

必須抽出項目：
1. RSI値と評価
2. MACD状況  
3. ボリンジャーバンド状況
4. 移動平均線の状況（5MA, 20MA, 60MA）
5. 出来高傾向
6. 全体的なトレンド
7. サポート・レジスタンスレベル

以下のJSON形式で返してください：
```json
{
  "rsi": {
    "value": 65,
    "evaluation": "やや強気",
    "comment": "60-70圏内で上昇トレンド継続中"
  },
  "macd": {
    "value": "ゴールデンクロス",
    "evaluation": "強気",
    "comment": "MACDラインがシグナルラインを上抜け、ヒストグラムも拡大"
  },
  "bollinger_band": {
    "value": "バンド中央付近",
    "evaluation": "中立",
    "comment": "ボリンジャーバンド中央付近で横ばい"
  },
  "volume": {
    "value": "増加傾向",
    "evaluation": "やや強気",
    "comment": "直近5日で出来高が増加、買い圧力が強まる"
  },
  "trend": {
    "value": "上昇トレンド",
    "evaluation": "強気",
    "comment": "高値・安値を切り上げており上昇トレンド継続"
  },
  "support_resistance": {
    "value": "サポート: 1000円, レジスタンス: 1200円",
    "evaluation": "中立",
    "comment": "重要な水準での攻防が続く"
  }
}
```

evaluation は必ず "強気", "やや強気", "中立", "やや弱気", "弱気" のいずれかを使用してください。
"""

        user_prompt = f"この{symbol_context or '株価'}のチャート画像を解析し、{analysis_context or 'テクニカル指標'}を上記JSON形式で抽出してください。"

        try:
            response = openai.ChatCompletion.create(
                model="gpt-4o-mini",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user", 
                        "content": [
                            {"type": "text", "text": user_prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=800
            )
            
            content = response.choices[0].message.content
            return self._extract_json_from_response(content)
            
        except Exception as e:
            print(f"GPT analysis failed: {e}")
            return self._get_fallback_gpt_result()
    
    def gpt_result_to_indicators(self, gpt_result: Dict[str, Any]) -> List[IndicatorItem]:
        """GPT分析結果をIndicatorItem形式に変換"""
        indicators = []
        
        # RSI
        if 'rsi' in gpt_result:
            rsi_data = gpt_result['rsi']
            indicators.append(IndicatorItem(
                name="RSI（相対力指数）",
                value=rsi_data.get('value', 50),
                evaluation=rsi_data.get('evaluation', '中立'),
                comment=rsi_data.get('comment', 'RSI分析結果'),
                source="gpt_analysis",
                confidence=0.75
            ))
        
        # MACD
        if 'macd' in gpt_result:
            macd_data = gpt_result['macd']
            indicators.append(IndicatorItem(
                name="MACD",
                value=macd_data.get('value', '中立'),
                evaluation=macd_data.get('evaluation', '中立'),
                comment=macd_data.get('comment', 'MACD分析結果'),
                source="gpt_analysis",
                confidence=0.70
            ))
        
        # ボリンジャーバンド
        if 'bollinger_band' in gpt_result:
            bb_data = gpt_result['bollinger_band']
            indicators.append(IndicatorItem(
                name="ボリンジャーバンド",
                value=bb_data.get('value', '中央付近'),
                evaluation=bb_data.get('evaluation', '中立'),
                comment=bb_data.get('comment', 'ボリンジャーバンド分析結果'),
                source="gpt_analysis",
                confidence=0.65
            ))
        
        # 出来高
        if 'volume' in gpt_result:
            volume_data = gpt_result['volume']
            indicators.append(IndicatorItem(
                name="出来高傾向（GPT）",
                value=volume_data.get('value', '普通'),
                evaluation=volume_data.get('evaluation', '中立'),
                comment=volume_data.get('comment', '出来高分析結果'),
                source="gpt_analysis",
                confidence=0.80
            ))
        
        # トレンド
        if 'trend' in gpt_result:
            trend_data = gpt_result['trend']
            indicators.append(IndicatorItem(
                name="トレンド分析",
                value=trend_data.get('value', '横ばい'),
                evaluation=trend_data.get('evaluation', '中立'),
                comment=trend_data.get('comment', 'トレンド分析結果'),
                source="gpt_analysis",
                confidence=0.85
            ))
        
        # サポート・レジスタンス
        if 'support_resistance' in gpt_result:
            sr_data = gpt_result['support_resistance']
            indicators.append(IndicatorItem(
                name="サポート・レジスタンス",
                value=sr_data.get('value', '要監視'),
                evaluation=sr_data.get('evaluation', '中立'),
                comment=sr_data.get('comment', 'サポート・レジスタンス分析結果'),
                source="gpt_analysis",
                confidence=0.70
            ))
        
        return indicators
    
    def _extract_json_from_response(self, content: str) -> Dict[str, Any]:
        """GPT応答からJSONを抽出"""
        try:
            # JSONブロックを探す
            json_match = re.search(r'```json\s*(\{.*?\})\s*```', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(1))
            
            # JSON形式のテキストを直接探す
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                return json.loads(json_match.group(0))
            
            # 見つからない場合は自然文からパース（簡易版）
            return self._parse_natural_text(content)
            
        except json.JSONDecodeError:
            print("Failed to parse JSON from GPT response")
            return self._parse_natural_text(content)
    
    def _parse_natural_text(self, content: str) -> Dict[str, Any]:
        """自然文から指標を抽出（フォールバック）"""
        result = {}
        
        # RSI値を抽出
        rsi_match = re.search(r'RSI[：:]?\s*(\d+)', content)
        if rsi_match:
            rsi_value = int(rsi_match.group(1))
            evaluation = "強気" if rsi_value > 70 else "弱気" if rsi_value < 30 else "中立"
            result['rsi'] = {
                'value': rsi_value,
                'evaluation': evaluation,
                'comment': f'RSI {rsi_value}、{evaluation}圏内'
            }
        
        # トレンドワード検出
        if any(word in content for word in ['上昇', '上向き', '強気']):
            result['trend'] = {
                'value': '上昇トレンド',
                'evaluation': '強気',
                'comment': '上昇トレンドが継続中'
            }
        elif any(word in content for word in ['下降', '下向き', '弱気']):
            result['trend'] = {
                'value': '下降トレンド', 
                'evaluation': '弱気',
                'comment': '下降トレンドが継続中'
            }
        
        return result
    
    def _get_fallback_gpt_result(self) -> Dict[str, Any]:
        """GPT分析エラー時のフォールバック結果"""
        return {
            'rsi': {
                'value': 50,
                'evaluation': '中立',
                'comment': 'RSI分析データを取得できませんでした'
            },
            'trend': {
                'value': '不明',
                'evaluation': '中立',
                'comment': 'トレンド分析データを取得できませんでした'
            },
            'volume': {
                'value': '不明',
                'evaluation': '中立',
                'comment': '出来高分析データを取得できませんでした'
            }
        }