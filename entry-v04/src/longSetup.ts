/**
 * Entry足判定 v0.4 統合API
 * 
 * Pivot v1.3 と Entry v0.4 を統合した押し目ロング判定
 */

import type { Bar, Indicators, Context, PivotSummary, LongSetupResult } from './types.js';
import { scoreEntryV04 } from './entryScore.js';

/**
 * Pivot v1.3 のスコア計算（モック実装）
 * 
 * 実際の運用では既存のPivot v1.3モジュールをインポートして使用
 * 
 * @param bar - 足データ
 * @param indicators - テクニカル指標
 * @param context - コンテキスト
 * @returns Pivot判定結果
 */
function scorePivotV13Mock(
  bar: Bar,
  indicators: Indicators,
  _context: Context = {}
): PivotSummary {
  // モック実装：実際には既存のPivot v1.3を呼び出し
  // ここでは簡易的な判定を行う
  
  const sma20 = indicators.sma20;
  const volMA5 = indicators.volMA5 ?? 1;
  
  // 簡易スコア計算
  let score = 50; // ベース
  
  // 出来高チェック
  if (bar.volume > volMA5 * 1.2) score += 15;
  
  // MA位置チェック
  if (sma20 != null && Math.abs(bar.close - sma20) / bar.close <= 0.02) {
    score += 20;
  }
  
  // 実体チェック
  const body = Math.abs(bar.close - bar.open) / Math.max(1e-9, bar.high - bar.low);
  if (body >= 0.3) score += 10;
  
  const isPivot = score >= 65;
  
  return {
    version: 'v1.3',
    final: Math.round(score),
    isPivot,
  };
}

/**
 * 総合判定を決定
 * @param pivot - Pivot判定結果
 * @param entry - Entry判定結果
 * @returns 総合判定
 */
function determineVerdict(
  pivot: PivotSummary,
  entry: { label: '強エントリー' | 'エントリー可' | '見送り' }
): '推奨' | '保留' | '非推奨' {
  if (!pivot.isPivot) {
    return '非推奨';
  }
  
  if (entry.label === '見送り') {
    return '保留';
  }
  
  return '推奨';
}

/**
 * 押し目ロングセットアップの総合評価
 * @param bar - 評価対象の足データ
 * @param indicators - テクニカル指標
 * @param context - コンテキスト（オプション）
 * @returns 総合判定結果
 */
export function evaluateLongSetup(
  bar: Bar,
  indicators: Indicators,
  context: Context = {}
): LongSetupResult {
  // Pivot v1.3 判定
  const pivot = scorePivotV13Mock(bar, indicators, context);
  
  // Entry v0.4 判定
  const entry = scoreEntryV04(bar, indicators, context);
  
  // 総合判定
  const verdict = determineVerdict(pivot, entry);
  
  return {
    kind: '押し目ロングの型',
    pivot,
    entry,
    verdict,
  };
}

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