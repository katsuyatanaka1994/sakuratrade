/**
 * Pivot足判定ロジック v1.3
 * 
 * ESM TypeScript モジュールのエントリーポイント
 * すべてのpublic APIを再エクスポート
 */

export {
  // メイン関数
  scorePivot,
  
  // サブスコア計算関数（テスト・デバッグ用）
  candleScore,
  locationScore,
  slopeScore,
  volumeScore,
  getPriceBand,
  
  // 型定義
  type PivotInput,
  type PivotResult,
  type LocationResult,
  type SlopeResult,
} from './pivotScore.js';

export {
  // 設定関連
  getConfig,
  defaultConfig,
  type PivotConfig,
  type PriceBand,
} from './config.js';