/**
 * Entry足判定 v0.4 メインスコア計算
 *
 * エントリー足の総合評価
 */
import type { Bar, Indicators, Context, EntrySummary } from './types.js';
/**
 * Entry足判定 v0.4 メイン関数
 * @param bar - 評価対象の足データ
 * @param indicators - テクニカル指標
 * @param context - コンテキスト（オプション）
 * @returns エントリー判定結果
 */
export declare function scoreEntryV04(bar: Bar, indicators: Indicators, context?: Context): EntrySummary;
//# sourceMappingURL=entryScore.d.ts.map