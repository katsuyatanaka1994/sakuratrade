/**
 * Entry足判定 v0.4 ゲート検証
 * 
 * エントリー条件のゲート判定
 */

import type { Indicators, Context, Options } from './types.js';

/**
 * ゲート検証結果
 */
export type GateValidationResult = {
  /** 全体でゲート通過したか */
  passed: boolean;
  /** 個別チェック結果 */
  checks: {
    pivotExpiry: { passed: boolean; reason?: string };
    priceLocation: { passed: boolean; reason?: string };
  };
  /** 失敗理由一覧 */
  failures: string[];
};

/**
 * Pivot有効期限チェック
 * @param context - コンテキスト
 * @param options - オプション
 * @returns チェック結果
 */
function checkPivotExpiry(
  context: Context, 
  options: Options
): { passed: boolean; reason?: string } {
  const recentPivotBarsAgo = context.recentPivotBarsAgo;
  
  // Pivot位置が不明な場合は失敗
  if (recentPivotBarsAgo == null) {
    return { 
      passed: false, 
      reason: 'Pivot位置が不明' 
    };
  }
  
  // 有効期限チェック
  if (recentPivotBarsAgo > options.pivotLookbackBars) {
    return { 
      passed: false, 
      reason: `Pivot有効期限切れ（${recentPivotBarsAgo}営業日前 > ${options.pivotLookbackBars}営業日）` 
    };
  }
  
  return { passed: true };
}

/**
 * 価格ロケーションチェック
 * @param close - 終値
 * @param indicators - テクニカル指標
 * @param options - オプション
 * @returns チェック結果
 */
function checkPriceLocation(
  close: number, 
  indicators: Indicators, 
  options: Options
): { passed: boolean; reason?: string } {
  const sma5 = indicators.sma5;
  const sma20 = indicators.sma20;
  
  // SMA5が不明
  if (sma5 == null) {
    return { 
      passed: false, 
      reason: '5MA が取得できません' 
    };
  }
  
  // SMA20が不明
  if (sma20 == null) {
    return { 
      passed: false, 
      reason: '20MA が取得できません' 
    };
  }
  
  // 5MA >= 20MA チェック
  if (sma5 < sma20) {
    return { 
      passed: false, 
      reason: `5MA < 20MA （5MA: ${sma5.toFixed(0)}, 20MA: ${sma20.toFixed(0)}）` 
    };
  }
  
  // close >= sma5 * (1 - eps) チェック
  const threshold = sma5 * (1 - options.allowEpsilonOnSMA5);
  if (close < threshold) {
    return { 
      passed: false, 
      reason: `終値が5MA未満 （終値: ${close.toFixed(0)}, 5MA: ${sma5.toFixed(0)}）` 
    };
  }
  
  return { passed: true };
}

/**
 * ゲート検証を実行
 * @param close - 終値
 * @param indicators - テクニカル指標
 * @param context - コンテキスト
 * @param options - オプション
 * @returns 検証結果
 */
export function validateGate(
  close: number,
  indicators: Indicators,
  context: Context,
  options: Options
): GateValidationResult {
  // 個別チェック実行
  const pivotExpiry = checkPivotExpiry(context, options);
  const priceLocation = checkPriceLocation(close, indicators, options);
  
  // 失敗理由収集
  const failures: string[] = [];
  if (!pivotExpiry.passed && pivotExpiry.reason) {
    failures.push(pivotExpiry.reason);
  }
  if (!priceLocation.passed && priceLocation.reason) {
    failures.push(priceLocation.reason);
  }
  
  return {
    passed: pivotExpiry.passed && priceLocation.passed,
    checks: {
      pivotExpiry,
      priceLocation,
    },
    failures,
  };
}