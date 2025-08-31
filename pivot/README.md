# Pivot足判定ロジック v1.3

押し目ロング戦略における**Pivot足判定**を行うTypeScript/ESMモジュールです。

## 概要

このモジュールは、株価のローソク足データから「押し目ロング」のエントリータイミングに適したPivot足を判定します。足形・ロケーション・傾き・出来高の4つの要素を総合的に評価し、**65点以上でPivot認定**します。

## 特徴

- ✅ **純関数設計**: 副作用なし・不変データ
- ✅ **型安全**: TypeScriptで完全に型付け
- ✅ **ESMモジュール**: Node.js 18+ 対応
- ✅ **設定外出し**: JSON設定で調整可能
- ✅ **ユニットテスト**: 包括的なテストスイート
- ✅ **ゼロ除算防止**: 堅牢なエラーハンドリング

## インストール

```bash
npm install
npm run build
```

## 基本的な使い方

```typescript
import { scorePivot, type PivotInput } from './dist/index.js';

// 入力データを準備
const input: PivotInput = {
  date: '2024-01-15',
  open: 5000,
  high: 5300,
  low: 4950,
  close: 5200,
  volume: 150000,
  volMA5: 100000,      // 5日平均出来高
  sma20: 5150,         // 20日移動平均
  sma60: 5000,         // 60日移動平均
  sma20_5ago: 5100,    // 5日前の20日移動平均
  sma60_5ago: 4980,    // 5日前の60日移動平均
};

// Pivot判定を実行
const result = scorePivot(input);

console.log(result.final);     // 78.5（最終スコア）
console.log(result.isPivot);   // true（Pivot認定）
console.log(result.explain);   // 詳細な説明文字列
```

## 判定ロジック

### 1. Candleスコア（0-100点）

ローソク足の形状を評価します。重み: **25%**

| 足形 | 条件 | スコア |
|------|------|--------|
| 上髭陽線（トンカチ） | `close>open ∧ 上髭≥30%` | 0 |
| 丸坊主陰線 | `close<open ∧ 実体≥90%` | 0 |
| カラカサ陽線 | `close>open ∧ 下影≥30%` | 90 |
| 下影陰線 | `close<open ∧ 下影≥30%` | 65 |
| 大陽線 | `close>open ∧ 実体≥70%` | 80 |
| 中陽線 | `close>open ∧ 30%<実体<70%` | 70 |
| 小陽線/コマ | `close>open ∧ 実体≤30%` | 40 |
| 陰線コマ | その他の陰線 | 20 |

**比率計算式:**
- 実体率 = `|close-open| / (high-low)`
- 上髭比率 = `(high-max(open,close)) / (high-low)`
- 下影比率 = `(min(open,close)-low) / (high-low)`

### 2. Locationスコア（0-100点）

移動平均線との近接度を評価します。重み: **35%**

**近接条件**: `|終値 - MA| / 終値 ≤ 1%`

| 株価帯 | 20MA近接 | 60MA近接 | 20&60近接 | 非近接 |
|--------|----------|----------|-----------|--------|
| 小型株(<3,000円) | 100 | 70 | 85 | 0 |
| 中型株(3,000-10,000円) | 90 | 60 | 75 | 0 |
| 値嵩株(≥10,000円) | 80 | 50 | 65 | 0 |

### 3. Slopeスコア（0-100点）

移動平均線の傾きを評価します。重み: **20%**

**傾き計算**: `傾き% = 100 * (現在MA - 5日前MA) / 5日前MA`

**方向判定**: 
- 上昇: 傾き% ≥ +0.5%
- 下降: 傾き% ≤ -0.5%  
- 横ばい: その他

| MA | 上昇 | 横ばい | 下降 |
|----|------|--------|------|
| 20MA | 100 | 60 | 0 |
| 60MA | 70 | 50 | 30 |

**合成**: `Slope = 0.7 × 20MAスコア + 0.3 × 60MAスコア`

### 4. Volumeスコア（0-100点）

出来高の多さを評価します。重み: **20%**

**計算式**: `min(100, 100 × 出来高 / (1.5 × 5日平均出来高))`

5日平均の1.5倍で100点満点、それ以上は100点でクリップされます。

### 最終判定

**最終スコア** = `0.25×Candle + 0.35×Location + 0.20×Slope + 0.20×Volume`

**Pivot認定**: 最終スコア ≥ 65点

## 出力例

```typescript
{
  scores: { candle: 70, location: 90, slope: 85, volume: 100 },
  weighted: { candle: 17.5, location: 31.5, slope: 17.0, volume: 20.0 },
  final: 86.0,
  isPivot: true,
  explain: "=== Pivot足判定 v1.3 ===\\nCandle: 70点 → 寄与 17.5点 (重み25%)\\n...",
  meta: {
    priceBand: 'mid',
    near20: true,
    near60: false,
    slope20pct: 1.0,
    slope60pct: 0.4,
    version: 'v1.3'
  }
}
```

## API リファレンス

### メイン関数

#### `scorePivot(input: PivotInput): PivotResult`

Pivot足の総合判定を行います。

### サブスコア関数

#### `candleScore(open, high, low, close): number`

ローソク足形状のスコアを計算。

#### `locationScore(close, sma20?, sma60?): LocationResult`

移動平均近接度のスコアを計算。

#### `slopeScore(sma20?, sma20_5ago?, sma60?, sma60_5ago?): SlopeResult`

移動平均傾きのスコアを計算。

#### `volumeScore(volume, volMA5): number`

出来高のスコアを計算。

## 設定のカスタマイズ

`src/config.ts` で各種パラメータを調整できます：

```typescript
export const defaultConfig = {
  weights: { candle: 0.25, location: 0.35, slope: 0.20, volume: 0.20 },
  thresholds: { final: 65, nearPct: 0.01, slopePct: 0.5 },
  // ...
};
```

### 主要設定項目

- `weights`: 各要素の重み（合計1.0）
- `thresholds.final`: Pivot認定の閾値（既定65点）
- `thresholds.nearPct`: MA近接判定の閾値（既定1%）
- `thresholds.slopePct`: 傾き上下判定の閾値（既定0.5%）

## テスト実行

```bash
npm test                # テスト実行
npm run test:coverage   # カバレッジ付きテスト
```

## 開発・ビルド

```bash
npm run build          # TypeScript → JavaScript
npm run test           # テスト実行
```

## 注意点

### 過学習の回避

このロジックは特定の市場環境・銘柄群での検証に基づいています。本番使用前に：

1. **異なる時期**でのバックテスト
2. **異なる銘柄群**での検証
3. **閾値の感度分析**（±5点程度）

### エラーハンドリング

- **MA未定義**: 近接判定はfalse、傾きは0%として処理
- **ゼロ除算**: 分母に `max(1e-9, value)` を使用して防御
- **異常値**: `high < low` 等は自動修正せず、範囲計算で防御

### パフォーマンス

- すべて純関数で副作用なし
- 入力オブジェクトは変更されない
- メモリ効率を考慮した実装

## CHANGELOG

### v1.3 (2024-01-19)
- 重み調整: 足形25%→25%、ロケーション30%→35%、傾き25%→20%、出来高20%→20%
- 設定の外部化とJSON対応準備
- ユニットテストの充実化
- TypeScript strict mode対応

### v1.2 (2024-01-15)
- 傾きスコア計算の改善
- エラーハンドリングの強化

### v1.1 (2024-01-10)
- 初期リリース

## ライセンス

MIT License

## 今後の予定

- エントリー足判定ロジックの追加
- JSON設定ファイル対応
- 複数足組み合わせ判定
- リアルタイムストリーミング対応