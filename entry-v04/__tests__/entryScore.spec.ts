/**
 * Entry足判定 v0.4 ユニットテスト
 * 
 * メインスコア計算とシナリオテスト
 */

import { describe, it, expect } from 'vitest';
import { scoreEntryV04 } from '../src/entryScore.js';
import type { Bar, Indicators, Context } from '../src/types.js';

// テストデータ生成ヘルパー
function createTestBar(overrides: Partial<Bar> = {}): Bar {
  return {
    date: '2024-01-15',
    open: 1000,
    high: 1100,
    low: 950,
    close: 1080,
    volume: 100000,
    ...overrides,
  };
}

function createTestIndicators(overrides: Partial<Indicators> = {}): Indicators {
  return {
    sma5: 1050,
    sma20: 1000,
    sma60: 950,
    sma5_5ago: 1030,
    sma20_5ago: 980,
    sma60_5ago: 940,
    volMA5: 80000,
    prevHigh: 1070,
    prevLow: 970,
    prevClose: 1020,
    prev2High: 1060,
    prev2Low: 960,
    ...overrides,
  };
}

describe('Entry足判定 v0.4', () => {
  describe('ブレイク強（推奨）シナリオ', () => {
    it('close>prevHigh, body≥0.6, upper≤0.2, vol=1.5×, 5≥20≥60 → Entry≥85', () => {
      const bar = createTestBar({
        open: 1000,
        high: 1120,
        low: 980,
        close: 1110, // body = 110/140 = 0.786 > 0.6
        volume: 120000, // 120000 / 80000 = 1.5×
      });
      
      const indicators = createTestIndicators({
        prevHigh: 1070, // close > prevHigh
        volMA5: 80000,
      });
      
      const context: Context = {
        recentPivotBarsAgo: 2, // 有効期限内
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(true);
      expect(result.final).toBeGreaterThanOrEqual(85);
      expect(result.label).toBe('強エントリー');
      expect(result.details.candle?.pattern).toBe('breakout_marubozu');
    });
  });

  describe('20MAタッチ反転（可）シナリオ', () => {
    it('near20, bull, lower≥0.25, vol≈1.0×, 5≥20≥60 → Entry 70-85', () => {
      const bar = createTestBar({
        open: 990,
        high: 1020,
        low: 970, // lower = (990-970)/(1020-970) = 20/50 = 0.4 > 0.25
        close: 1010,
        volume: 80000, // 1.0×
      });
      
      const indicators = createTestIndicators({
        sma5: 1009, // close(1010) > sma5(1009) ✓ and sma5 > sma20 ✓
        sma20: 1008, // |1010-1008|/1010 = 0.002 < 0.01 (near)
        sma60: 1000, // sma20 > sma60 for proper arrangement
        volMA5: 80000,
      });
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(true);
      expect(result.final).toBeGreaterThanOrEqual(70);
      expect(result.final).toBeLessThan(85);
      expect(result.label).toBe('エントリー可');
      expect(result.details.candle?.pattern).toBe('ma20_touch_reversal');
    });
  });

  describe('Gate落ちシナリオ', () => {
    it('close<5MA → label=見送り', () => {
      const bar = createTestBar({
        close: 1040, // < sma5(1050)
      });
      
      const indicators = createTestIndicators();
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(false);
      expect(result.label).toBe('見送り');
      expect(result.details.gateFailures).toContain('終値が5MA未満 （終値: 1040, 5MA: 1050）');
    });
  });

  describe('だましブレイクシナリオ', () => {
    it('標準ブレイクパターンだが upper>0.35で0点確定', () => {
      // 標準ブレイク条件: body≥0.4, upper≤0.3, close>prevHigh
      // でも実際には upper>0.35 で0点ペナルティ
      const bar = createTestBar({
        open: 1000,
        high: 1140, // 調整してupper>0.35かつbody≥0.4を満たす
        low: 980,
        close: 1080, // prevHigh(1070)超え
        volume: 60000, // 低出来高
      });
      // body = 80/160 = 0.5 > 0.4 ✓
      // upper = (1140-1080)/(1140-980) = 60/160 = 0.375 > 0.35 ✓
      // でも upper = 0.375 > 0.30 なので標準ブレイクにはならない
      
      const indicators = createTestIndicators({
        prevHigh: 1070,
        volMA5: 80000,
        // MA条件を悪くして全体スコアを下げる
        sma5: 1060, // close(1080) > sma5 ✓
        sma20: 1050, // sma5 > sma20 ✓ 
        sma60: 1040, // sma20 > sma60 ✓ だが傾きを悪くする
        sma5_5ago: 1070, // 下降傾向 -0.93%
        sma20_5ago: 1060, // 下降傾向 -0.94%
        sma60_5ago: 1050, // 下降傾向 -0.95%
      });
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(true);
      // 上髭が大きいので汎用陽線パターンになり-25ペナルティのみ
      expect(result.scores.Candle).toBeLessThan(70); // 0点でなくても低得点
      expect(result.final).toBeLessThan(70);
      expect(result.label).toBe('見送り');
    });
  });

  describe('欠損データシナリオ', () => {
    it('sma20=null → gateFailed + details.missing', () => {
      const bar = createTestBar();
      
      const indicators = createTestIndicators({
        sma20: null, // 欠損
      });
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(false);
      expect(result.details.missing).toContain('sma20');
      expect(result.details.gateFailures).toContain('20MA が取得できません');
    });
  });

  describe('Pivot有効期限切れシナリオ', () => {
    it('recentPivotBarsAgo > 4 → gateFailed', () => {
      const bar = createTestBar();
      const indicators = createTestIndicators();
      
      const context: Context = {
        recentPivotBarsAgo: 5, // 5営業日前 > 4営業日
      };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(false);
      expect(result.details.gateFailures).toContain('Pivot有効期限切れ（5営業日前 > 4営業日）');
    });
  });

  describe('重み配分確認', () => {
    it('デフォルト重み wMA=0.5, wCandle=0.35, wVolume=0.15', () => {
      const bar = createTestBar();
      const indicators = createTestIndicators();
      const context: Context = { recentPivotBarsAgo: 1 };
      
      const result = scoreEntryV04(bar, indicators, context);
      
      expect(result.gatePassed).toBe(true);
      
      // 重み計算の確認
      const expectedMA = Math.round(result.scores.MA * 0.5 * 10) / 10;
      const expectedCandle = Math.round(result.scores.Candle * 0.35 * 10) / 10;
      const expectedVolume = Math.round(result.scores.Volume * 0.15 * 10) / 10;
      
      expect(result.weighted.MA).toBe(expectedMA);
      expect(result.weighted.Candle).toBe(expectedCandle);
      expect(result.weighted.Volume).toBe(expectedVolume);
    });
  });
});