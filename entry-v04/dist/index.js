/**
 * Entry足判定 v0.4 エントリーポイント
 *
 * ESM TypeScript モジュールのメインエクスポート
 */
// メイン関数
export { scoreEntryV04 } from './entryScore.js';
export { evaluateLongSetup } from './longSetup.js';
// サブスコア計算関数（テスト・デバッグ用）
export { calculateMAScore, getMAFinalScore } from './maScore.js';
export { calculateCandleScore } from './candleScore.js';
export { calculateVolumeScore } from './volumeScore.js';
export { validateGate } from './gateValidation.js';
// 説明文生成
export { generateEntryExplain, generateLongSetupExplain, generateChatMessage, generateFailureDetails } from './explain.js';
// 設定関連
export { defaultOptions, mergeOptions, validateWeights } from './options.js';
// ユーティリティ（主要なもののみ）
export { clamp, nz, safeDiv, roundTo, changePercent, isBullish, isBearish, isNear } from './utils.js';
//# sourceMappingURL=index.js.map