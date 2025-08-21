/**
 * サブコンポーネント テスト
 */

import { describe, it, expect } from 'vitest';
import { calculateMAScore, getMAFinalScore } from '../src/maScore.js';
import { calculateCandleScore } from '../src/candleScore.js';
import { calculateVolumeScore } from '../src/volumeScore.js';
import { validateGate } from '../src/gateValidation.js';
import { defaultOptions } from '../src/options.js';
import type { Indicators, Bar, Context } from '../src/types.js';

describe('MAスコア計算', () => {
  it('上昇トレンド（5>20>60、全て上向き）で高得点', () => {
    const indicators: Indicators = {
      sma5: 1100,
      sma20: 1050,
      sma60: 1000,
      sma5_5ago: 1080,   // +1.85%
      sma20_5ago: 1020,  // +2.94%
      sma60_5ago: 980,   // +2.04%
    };
    
    const details = calculateMAScore(indicators, defaultOptions);
    const score = getMAFinalScore(details);
    
    expect(details.isProperArrangement).toBe(true); // 20 > 60
    expect(details.arrangementBonus).toBe(10);
    expect(details.sma5SlopePct).toBeGreaterThan(0.5); // 上向き
    expect(details.sma20SlopePct).toBeGreaterThan(0.5); // 上向き
    expect(details.sma60SlopePct).toBeGreaterThan(0.5); // 上向き
    expect(score).toBeGreaterThan(80); // 高得点期待
  });

  it('下降トレンド（全て下向き）で低得点', () => {
    const indicators: Indicators = {
      sma5: 950,
      sma20: 980,
      sma60: 1000,
      sma5_5ago: 970,   // -2.06%
      sma20_5ago: 1000, // -2.00%
      sma60_5ago: 1020, // -1.96%
    };
    
    const details = calculateMAScore(indicators, defaultOptions);
    const score = getMAFinalScore(details);
    
    expect(details.isProperArrangement).toBe(false); // 20 < 60
    expect(details.arrangementBonus).toBe(0);
    expect(score).toBeLessThan(50); // 低得点期待
  });
});

describe('Candleスコア計算', () => {
  it('ブレイク・マルボウズパターンで高得点', () => {
    const bar: Bar = {
      date: '2024-01-15',
      open: 1000,
      high: 1120,
      low: 980,
      close: 1110, // body=110/140=0.786>0.6, upper=10/140=0.071<0.2
      volume: 100000,
    };
    
    const indicators: Indicators = {
      prevHigh: 1070, // ブレイク条件
    };
    
    const details = calculateCandleScore(bar, indicators, defaultOptions);
    
    expect(details.pattern).toBe('breakout_marubozu');
    expect(details.baseScore).toBe(92);
    expect(details.bodyRatio).toBeGreaterThan(0.6);
    expect(details.upperRatio).toBeLessThan(0.2);
    expect(details.adjustedScore).toBe(92); // 補正なし
  });

  it('上髭でペナルティ適用', () => {
    const bar: Bar = {
      date: '2024-01-15',
      open: 1000,
      high: 1150, // 大きな上髭
      low: 980,
      close: 1090,
      volume: 100000,
    };
    
    const indicators: Indicators = {
      prevHigh: 1070,
    };
    
    const details = calculateCandleScore(bar, indicators, defaultOptions);
    
    expect(details.upperRatio).toBeGreaterThan(0.35);
    expect(details.adjustments.upperPenalty).toBeLessThan(0);
    expect(details.adjustedScore).toBeLessThan(details.baseScore);
  });

  it('20MAタッチ反転パターン', () => {
    const bar: Bar = {
      date: '2024-01-15',
      open: 990,
      high: 1020,
      low: 970, // 下髭十分
      close: 1010, // 陽線
      volume: 100000,
    };
    
    const indicators: Indicators = {
      sma20: 1008, // 近接
    };
    
    const details = calculateCandleScore(bar, indicators, defaultOptions);
    
    expect(details.pattern).toBe('ma20_touch_reversal');
    expect(details.baseScore).toBe(78);
    expect(details.lowerRatio).toBeGreaterThanOrEqual(0.25);
  });
});

describe('Volumeスコア計算', () => {
  it('1.5倍出来高で100点', () => {
    const bar: Bar = {
      date: '2024-01-15',
      open: 1000,
      high: 1100,
      low: 950,
      close: 1080,
      volume: 120000, // 1.5×
    };
    
    const indicators: Indicators = {
      volMA5: 80000,
    };
    
    const details = calculateVolumeScore(bar, indicators);
    
    expect(details.volumeRatio).toBe(1.5);
    expect(details.score).toBe(100);
  });

  it('0.5倍出来高で低得点', () => {
    const bar: Bar = {
      date: '2024-01-15',
      open: 1000,
      high: 1100,
      low: 950,
      close: 1080,
      volume: 40000, // 0.5×
    };
    
    const indicators: Indicators = {
      volMA5: 80000,
    };
    
    const details = calculateVolumeScore(bar, indicators);
    
    expect(details.volumeRatio).toBe(0.5);
    expect(details.score).toBeCloseTo(33); // 100 * 0.5 / 1.5 ≈ 33
  });
});

describe('ゲート検証', () => {
  it('全条件満たしてゲート通過', () => {
    const indicators: Indicators = {
      sma5: 1050,
      sma20: 1000, // 5 > 20
    };
    
    const context: Context = {
      recentPivotBarsAgo: 2, // ≤ 4
    };
    
    const result = validateGate(1060, indicators, context, defaultOptions); // close > sma5
    
    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
  });

  it('Pivot有効期限切れでゲート失敗', () => {
    const indicators: Indicators = {
      sma5: 1050,
      sma20: 1000,
    };
    
    const context: Context = {
      recentPivotBarsAgo: 5, // > 4
    };
    
    const result = validateGate(1060, indicators, context, defaultOptions);
    
    expect(result.passed).toBe(false);
    expect(result.checks.pivotExpiry.passed).toBe(false);
    expect(result.failures[0]).toContain('Pivot有効期限切れ');
  });

  it('価格条件未達でゲート失敗', () => {
    const indicators: Indicators = {
      sma5: 1050,
      sma20: 1000,
    };
    
    const context: Context = {
      recentPivotBarsAgo: 1,
    };
    
    const result = validateGate(1040, indicators, context, defaultOptions); // close < sma5
    
    expect(result.passed).toBe(false);
    expect(result.checks.priceLocation.passed).toBe(false);
    expect(result.failures[0]).toContain('終値が5MA未満');
  });

  it('データ欠損でゲート失敗', () => {
    const indicators: Indicators = {
      sma5: null, // 欠損
      sma20: 1000,
    };
    
    const context: Context = {
      recentPivotBarsAgo: 1,
    };
    
    const result = validateGate(1060, indicators, context, defaultOptions);
    
    expect(result.passed).toBe(false);
    expect(result.failures[0]).toContain('5MA が取得できません');
  });
});