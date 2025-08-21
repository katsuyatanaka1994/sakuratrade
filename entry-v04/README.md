# Entry足判定 v0.4

押し目ロングのエントリー足判定システム。既存のPivot v1.3と統合して、総合的な「押し目ロングの型」を評価します。

## 概要

このモジュールは、チャートトレード画面でアップロードされたチャート画像の数値データを受け取り、エントリー足の妥当性を0-100のスコアで評価します。Pivot認定ルール v1.3と組み合わせることで、押し目ロング戦略の総合判定を提供します。

### 主な特徴

- **純関数設計**: 副作用なし、I/Oなし
- **TypeScript**: 型安全性とIntelliSense対応
- **ESM モジュール**: Node.js 18+ 対応
- **包括的テスト**: Vitest によるユニットテスト
- **数式ベース**: 明確な評価基準と重み付け

## インストール

```bash
npm install entry-v04
```

## 基本的な使用方法

### 単体でのエントリー判定

```typescript
import { scoreEntryV04 } from 'entry-v04';

const bar = {
  date: '2024-01-15',
  open: 1000,
  high: 1120,
  low: 980,
  close: 1110,
  volume: 150000,
};

const indicators = {
  sma5: 1050,
  sma20: 1000,
  sma60: 950,
  sma5_5ago: 1030,
  sma20_5ago: 980,
  sma60_5ago: 940,
  volMA5: 100000,
  prevHigh: 1070,
  prevLow: 970,
  prevClose: 1020,
};

const context = {
  recentPivotBarsAgo: 2, // 2営業日前にPivotあり
};

const result = scoreEntryV04(bar, indicators, context);
console.log(result);
// {
//   version: 'v0.4',
//   gatePassed: true,
//   scores: { MA: 78, Candle: 92, Volume: 100 },
//   weighted: { MA: 39.0, Candle: 32.2, Volume: 15.0 },
//   final: 86.2,
//   label: '強エントリー',
//   explain: '強エントリー（86.2点）: MA 順調, Candle breakout marubozu, Vol 1.5×',
//   details: { ... }
// }
```

### Pivot v1.3との統合判定

```typescript
import { evaluateLongSetup } from 'entry-v04';

const result = evaluateLongSetup(bar, indicators, context);
console.log(result);
// {
//   kind: '押し目ロングの型',
//   pivot: { version: 'v1.3', final: 78, isPivot: true },
//   entry: { version: 'v0.4', final: 86.2, label: '強エントリー', ... },
//   verdict: '推奨'
// }
```

## 評価システム

### ゲート条件（必須）

エントリー判定を行う前に、以下の条件をすべて満たす必要があります：

1. **Pivot有効期限**: `recentPivotBarsAgo ≤ 4`営業日
2. **価格ロケーション**: `close ≥ sma5 * (1 - ε)` かつ `sma5 ≥ sma20`

### スコア構成

最終スコア = **50% × MA** + **35% × Candle** + **15% × Volume**

#### 1. MAスコア（0-100）

**傾きスコア**（5日変化率による判定）

| MA | 上昇(≥+0.5%) | 横ばい | 下降(≤-0.5%) |
|----|-------------|--------|-------------|
| 5MA | 80点 | 50点 | 20点 |
| 20MA | 100点 | 60点 | 0点 |
| 60MA | 80点 | 55点 | 25点 |

**合成**: `0.1×S5 + 0.6×S20 + 0.3×S60`

**並びボーナス**: `sma20 > sma60` の場合 +10点

#### 2. Candleスコア（0-100）

**基礎パターン**（優先順位）

| パターン | 条件 | 基礎点 |
|---------|------|--------|
| ブレイク・マルボウズ | `close > prevHigh` ∧ `body≥0.60` ∧ `upper≤0.20` | 92 |
| 標準ブレイク | `close > prevHigh` ∧ `body≥0.40` ∧ `upper≤0.30` | 85 |
| インサイド上放れ | `inside(前日, 前々日)` ∧ `close > prevHigh` | 82 |
| 20MAタッチ反転 | `\|close−sma20\|/close ≤ 1%` ∧ `陽線` ∧ `lower≥0.25` | 78 |
| エンガルフィング@20MA | `前日陰線` ∧ `陽線` ∧ `body包含` ∧ `20MA近接` | 76 |
| 続伸・小実体(HHHL) | `H>prevH` ∧ `L>prevL` ∧ `body<0.30` | 62 |
| 汎用陽線 | `陽線` ∧ `0.30≤body<0.70` | 68 |
| その他 | 上記以外 | 30 |

**補正**

- **上髭ペナルティ**: `upper>0.35` → ブレイク系は**0点確定**、その他は-25点
- **CLV補正**: `CLV≥0.70` → +5点、`CLV≤0.30` → -10点（20MAタッチ反転は除外）
- **レンジ補正**: `rangeRatio≥1.3` → +5点、`≤0.7` → -5点
- **ギャップ失速**: `gap%≥+2%` ∧ `CLV<0.5` → -20点

#### 3. Volumeスコア（0-100）

```
VolumeScore = min(100, 100 × volume / (1.5 × volMA5))
```

### ラベル判定

- **強エントリー**: `final ≥ 85` かつ `gatePassed = true`
- **エントリー可**: `70 ≤ final < 85` かつ `gatePassed = true`  
- **見送り**: `final < 70` または `gatePassed = false`

## 統合判定（押し目ロングの型）

| Pivot | Entry | 総合判定 |
|-------|-------|----------|
| 認定 | 強エントリー/エントリー可 | **推奨** |
| 認定 | 見送り | **保留** |
| 非認定 | （問わず） | **非推奨** |

## 設定・カスタマイズ

```typescript
import { scoreEntryV04, mergeOptions } from 'entry-v04';

// カスタム設定
const customOptions = {
  entryCutoff: 75,      // エントリー可能ライン（既定70）
  strongCutoff: 90,     // 強エントリーライン（既定85）
  wMA: 0.6,            // MA重み（既定0.5）
  wCandle: 0.3,        // Candle重み（既定0.35）
  wVolume: 0.1,        // Volume重み（既定0.15）
  slopePct: 0.3,       // 傾き判定閾値%（既定0.5）
};

const result = scoreEntryV04(bar, indicators, {
  recentPivotBarsAgo: 1,
  options: customOptions
});
```

## データ形式

### 入力型

```typescript
type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Indicators = {
  sma5?: number | null;
  sma20?: number | null;
  sma60?: number | null;
  sma5_5ago?: number | null;
  sma20_5ago?: number | null;
  sma60_5ago?: number | null;
  volMA5?: number | null;
  prevHigh?: number | null;
  prevLow?: number | null;
  prevClose?: number | null;
  prev2High?: number | null;    // インサイド判定用
  prev2Low?: number | null;
};

type Context = {
  recentPivotBarsAgo?: number | null;
  priceBand?: 'small' | 'mid' | 'large';
  options?: Partial<Options>;
};
```

### 出力型

```typescript
type EntrySummary = {
  version: 'v0.4';
  gatePassed: boolean;
  scores: { MA: number; Candle: number; Volume: number };
  weighted: { MA: number; Candle: number; Volume: number };
  final: number;
  label: '強エントリー' | 'エントリー可' | '見送り';
  explain: string;
  details: {
    ma?: MAScoreDetails;
    candle?: CandleScoreDetails;
    volume?: VolumeScoreDetails;
    missing?: string[];
    gateFailures?: string[];
  };
};
```

## エラーハンドリング

### データ欠損

```typescript
const indicators = {
  sma5: 1050,
  sma20: null,    // 欠損
  // ...
};

const result = scoreEntryV04(bar, indicators, context);
console.log(result.gatePassed);           // false
console.log(result.details.missing);      // ['sma20']
console.log(result.details.gateFailures); // ['20MA が取得できません']
```

### ゲート失敗

```typescript
const context = { recentPivotBarsAgo: 5 }; // 期限切れ

const result = scoreEntryV04(bar, indicators, context);
console.log(result.gatePassed);           // false
console.log(result.details.gateFailures); // ['Pivot有効期限切れ（5営業日前 > 4営業日）']
console.log(result.label);                // '見送り'
```

## 計算例

### ブレイク強エントリーの例

```typescript
// 入力データ
const bar = {
  open: 1000, high: 1120, low: 980, close: 1110, volume: 150000
};
const indicators = {
  sma5: 1050, sma20: 1000, sma60: 950,
  sma5_5ago: 1030, sma20_5ago: 980, sma60_5ago: 940,
  volMA5: 100000, prevHigh: 1070
};

// 計算過程
// 1. ゲート
//    - close(1110) >= sma5(1050) ✓
//    - sma5(1050) >= sma20(1000) ✓
//    - recentPivotBarsAgo(2) <= 4 ✓

// 2. Candle: ブレイク・マルボウズ
//    - close(1110) > prevHigh(1070) ✓
//    - body = |1110-1000|/(1120-980) = 110/140 = 0.786 >= 0.6 ✓
//    - upper = (1120-1110)/140 = 10/140 = 0.071 <= 0.2 ✓
//    - 基礎点: 92, 補正: なし → 92点

// 3. Volume
//    - ratio = 150000/100000 = 1.5
//    - score = min(100, 100×1.5/1.5) = 100点

// 4. MA
//    - sma5傾き = (1050-1030)/1030×100 = 1.94% → 上昇(80点)
//    - sma20傾き = (1000-980)/980×100 = 2.04% → 上昇(100点)  
//    - sma60傾き = (950-940)/940×100 = 1.06% → 上昇(80点)
//    - 合成 = 0.1×80 + 0.6×100 + 0.3×80 = 92点
//    - 並び = sma20(1000) > sma60(950) → +10点
//    - 最終 = min(100, 92+10) = 100点

// 5. 重み付け
//    - MA: 100 × 0.5 = 50.0
//    - Candle: 92 × 0.35 = 32.2  
//    - Volume: 100 × 0.15 = 15.0
//    - 最終: 50.0 + 32.2 + 15.0 = 97.2

// 結果: 97.2点 → 強エントリー
```

## 注意事項

### タイムフレーム

現在の実装は**日足専用**です。他のタイムフレーム（時間足・分足）は将来対応予定です。

### 0除算防止

すべての除算計算で安全な処理を実装していますが、入力データの品質確保も重要です：

```typescript
// 推奨: high >= low を事前確認
if (bar.high < bar.low) {
  throw new Error('Invalid OHLC data: high < low');
}
```

### パフォーマンス

1評価あたり数百マイクロ秒で動作します。大量データを処理する場合は適切なバッチ処理を検討してください。

## 開発・テスト

```bash
# 依存関係インストール
npm install

# ビルド
npm run build

# テスト実行
npm test

# テスト（ウォッチモード）
npm run test:watch

# テスト（UIモード）
npm run test:ui
```

### テストケース

- ブレイク強（推奨）シナリオ
- 20MAタッチ反転（可）シナリオ  
- ゲート落ちシナリオ
- だましブレイクシナリオ
- データ欠損シナリオ
- Pivot有効期限切れシナリオ

## ライセンス

MIT

## 変更履歴

### v0.4.0 (2024-01-15)
- 初回リリース
- Entry足判定ロジック実装
- Pivot v1.3統合API実装
- 包括的なユニットテスト追加