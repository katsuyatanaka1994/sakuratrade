/**
 * Entry足判定 v0.4 統合API
 *
 * Pivot v1.3 と Entry v0.4 を統合した押し目ロング判定
 */
import type { Bar, Indicators, Context, LongSetupResult } from './types.js';
/**
 * 押し目ロングセットアップの総合評価
 * @param bar - 評価対象の足データ
 * @param indicators - テクニカル指標
 * @param context - コンテキスト（オプション）
 * @returns 総合判定結果
 */
export declare function evaluateLongSetup(bar: Bar, indicators: Indicators, context?: Context): LongSetupResult;
/**
 * 実際のPivot v1.3を使用する場合の統合関数
 *
 * 使用例：
 * import { scorePivot } from '../pivot/src/index.js';
 *
 * export function evaluateLongSetupWithRealPivot(
 *   bar: Bar,
 *   indicators: Indicators,
 *   context: Context = {}
 * ): LongSetupResult {
 *   // 実際のPivot v1.3を呼び出し
 *   const pivotResult = scorePivot({
 *     date: bar.date,
 *     open: bar.open,
 *     high: bar.high,
 *     low: bar.low,
 *     close: bar.close,
 *     volume: bar.volume,
 *     volMA5: indicators.volMA5 ?? 0,
 *     sma20: indicators.sma20,
 *     sma60: indicators.sma60,
 *     sma20_5ago: indicators.sma20_5ago,
 *     sma60_5ago: indicators.sma60_5ago,
 *   });
 *
 *   const pivot: PivotSummary = {
 *     version: 'v1.3',
 *     final: pivotResult.final,
 *     isPivot: pivotResult.isPivot,
 *   };
 *
 *   const entry = scoreEntryV04(bar, indicators, context);
 *   const verdict = determineVerdict(pivot, entry);
 *
 *   return { kind: '押し目ロングの型', pivot, entry, verdict };
 * }
 */ 
//# sourceMappingURL=longSetup.d.ts.map