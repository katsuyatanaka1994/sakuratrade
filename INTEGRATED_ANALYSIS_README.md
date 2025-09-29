# 統合分析システム実装ガイド

## 📊 概要

このシステムは、チャート画像から以下の2つの手法を用いて総合的な投資判断を提供します：

1. **ルールベース分析** (pivot1.3 + entry-v04)
2. **GPT-4o画像解析** 

両者を統合し、構造化されたインジケーター配列として表示、自然言語でフィードバックを生成します。

## 🏗️ アーキテクチャ

```
チャート画像 + 建値
         ↓
  ┌─────────────────┐    ┌─────────────────┐
  │  ルールベース分析  │    │   GPT画像解析    │
  │  ・pivot v1.3    │    │  ・RSI/MACD     │
  │  ・entry v0.4    │    │  ・ボリンジャー   │
  │  ・移動平均/出来高 │    │  ・トレンド判定   │
  └─────────────────┘    └─────────────────┘
         ↓                        ↓
  ┌─────────────────────────────────────────┐
  │           統合・構造化処理                │
  │      (AnalysisIntegrator)               │
  └─────────────────────────────────────────┘
         ↓
  ┌─────────────────────────────────────────┐
  │   indicators配列 + 総合判定               │
  │   [{name, value, evaluation, comment}]  │
  └─────────────────────────────────────────┘
         ↓
  ┌─────────────────────────────────────────┐
  │        Jinja2テンプレート                │
  │        自然言語フィードバック             │
  └─────────────────────────────────────────┘
```

## 🚀 セットアップ

### 1. 依存関係インストール

```bash
# Python依存関係
pip install fastapi uvicorn pydantic jinja2 openai sqlalchemy asyncpg

# Node.js依存関係（pivot/entry-v04モジュール用）
cd pivot && npm install && npm run build
cd ../entry-v04 && npm install && npm run build
```

### 2. 環境変数設定

```bash
# .env ファイルに以下を追加
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. ルーター登録

`main.py` または FastAPI アプリケーションファイルに以下を追加：

```python
from routers.integrated_advice import router as integrated_router

app.include_router(integrated_router, prefix="/api/v1", tags=["integrated-analysis"])
```

## 📝 API エンドポイント

### 統合分析エンドポイント

```http
POST /api/v1/integrated-analysis
Content-Type: multipart/form-data

Parameters:
- file: チャート画像ファイル（PNG/JPEG）
- symbol: 銘柄名・証券コード（オプション）
- entry_price: 建値（オプション）
- position_type: "long" または "short"（オプション）
- analysis_context: 分析コンテキスト（オプション）

Response:
{
  "success": true,
  "analysis": {
    "timestamp": "2024-01-15T10:00:00",
    "symbol": "1234",
    "entry_price": 1000.0,
    "position_type": "long",
    "indicators": [
      {
        "name": "RSI（相対力指数）",
        "value": 65,
        "evaluation": "やや強気",
        "comment": "RSI 65、上昇トレンド継続中",
        "source": "gpt_analysis",
        "confidence": 0.75
      }
    ],
    "overall_evaluation": "推奨",
    "confidence_score": 0.85,
    "strategy_summary": "ロングポジションに適したタイミングです。"
  },
  "natural_feedback": "📊 **1234分析結果**（2024-01-15 10:00時点）..."
}
```

### クイック分析エンドポイント

```http
POST /api/v1/quick-analysis
Content-Type: multipart/form-data

Parameters:
- file: チャート画像ファイル
- symbol: 銘柄名（オプション）
- analysis_context: 分析コンテキスト（オプション）

Response:
{
  "success": true,
  "message": "📊 **チャート分析**\n\n簡易分析モードで実行されました。",
  "analysis_type": "quick_gpt_only"
}
```

### システム状態確認

```http
GET /api/v1/analysis-status

Response:
{
  "overall_status": "healthy",
  "details": {
    "integrated_analysis": "available",
    "rule_based_modules": {
      "pivot_v13": "available",
      "entry_v04": "available"
    },
    "gpt_analysis": "available"
  }
}
```

## 🧪 テスト実行

```bash
# 単体テスト実行
cd app
python -m pytest tests/test_integrated_analysis.py -v

# 統合テスト（実際のAPIエンドポイント）
curl -X POST "http://localhost:8000/api/v1/test-integration"
```

## 🔧 コアコンポーネント

### 1. スキーマ定義 (`schemas/indicators.py`)
- `IndicatorItem`: 個別インジケーター項目
- `TradingAnalysis`: 統合分析結果
- `AnalysisResponse`: API レスポンス

### 2. ルールベース分析 (`services/rule_based_analyzer.py`)
- Node.js 経由で pivot1.3/entry-v04 実行
- 結果を `IndicatorItem` 配列に変換
- フォールバック処理による堅牢性確保

### 3. GPT分析 (`services/gpt_analyzer.py`)
- GPT-4o による画像解析
- JSON パース + 自然文フォールバック
- テクニカル指標抽出（RSI, MACD, トレンド等）

### 4. 統合処理 (`services/analysis_integrator.py`)
- ルールベース + GPT結果のマージ
- 重複インジケーターの統合
- 信頼度・整合性チェック
- 総合評価算出（推奨/保留/非推奨）

### 5. テンプレートシステム (`templates/integrated_analysis.j2`)
- Markdown形式での自然言語出力
- 構造化テーブル表示
- 戦略アドバイス生成

## 📊 出力例

```markdown
📊 **1234分析結果**（2024-01-15 10:00時点）

---

## ✅ **統合判定: 推奨** 
**信頼度: 85.0%**

**ポジション**: ロング
**建値**: 1,000円

---

## 🔍 **テクニカル指標詳細**

| **項目** | **値** | **評価** | **コメント** |
|----------|--------|----------|--------------|
| ローソク足パターン | 80 | 強気 | Pivot足判定でのローソク足スコア: 80点。理想的なローソク足パターンです |
| 移動平均線位置 | 70点 (20MA近接) | やや強気 | 株価と移動平均線の位置関係: 20MA近接。スコア70点。 |
| RSI（相対力指数） | 65 | やや強気 | RSI 65、上昇トレンド継続中 |

---

## 🎯 **戦略アドバイス**

### 📋 **戦略概要**
ロングポジションに適したタイミングです。

### ✅ **チャンスポイント**
- 強力なエントリーシグナルが発生
- トレンド分析: ポジティブなトレンド

---

📝 **※ この分析結果は参考情報です。実際の投資判断は自己責任で行ってください。**
```

## ⚙️ カスタマイズ

### 評価基準の調整

`services/analysis_integrator.py` の `_calculate_overall_evaluation` 関数で：

```python
# 重み付け調整
integrated_score = rule_base_score * 0.7 + gpt_sentiment_score * 0.3

# 判定閾値調整
if integrated_score >= 70:  # 70 → 任意の値に変更
    return "推奨", confidence
```

### テンプレートのカスタマイズ

`templates/integrated_analysis.j2` を編集してMarkdown出力をカスタマイズ。

### 新しいインジケーター追加

1. `GPTAnalyzer.gpt_result_to_indicators()` に新しいインジケーター処理を追加
2. システムプロンプトで新しい抽出項目を指定
3. テンプレートで表示調整

## 🛠️ トラブルシューティング

### Node.js モジュールエラー
```bash
# モジュール再ビルド
cd pivot && npm run build
cd ../entry-v04 && npm run build
```

### OpenAI API エラー
```bash
# API キー確認
echo $OPENAI_API_KEY

# 使用量確認
curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/usage
```

### メモリ不足エラー
```bash
# 画像サイズ制限調整（integrated_advice.py）
if len(image_data) > 5 * 1024 * 1024:  # 5MB に縮小
```

## 📈 パフォーマンス

- **統合分析**: 約5-10秒（画像解析含む）
- **クイック分析**: 約2-3秒（GPTのみ）
- **ルールベース**: 約0.5秒（Node.js実行）
- **メモリ使用量**: 約100-200MB

## 🔄 今後の拡張予定

1. **リアルタイムデータ連携** - 証券API経由での価格データ取得
2. **バックテスト機能** - 過去データでの精度検証
3. **アラート機能** - 条件マッチ時の自動通知
4. **モバイルアプリ対応** - レスポンシブテンプレート
5. **機械学習強化** - 判定精度向上のためのモデル学習