/**
 * 押し目ロング統合判定テスト
 */

import { describe, it, expect } from 'vitest';
import { evaluateLongSetup } from '../src/longSetup.js';
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

describe('押し目ロング統合判定', () => {
  describe('推奨シナリオ', () => {
    it('Pivot認定 + Entry強 → 推奨', () => {
      const bar = createTestBar({
        open: 1000,
        high: 1120,
        low: 980,
        close: 1110,
        volume: 150000, // 高出来高でPivot・Entry両方高得点
      });
      
      const indicators = createTestIndicators({
        prevHigh: 1070,
        volMA5: 80000,
      });
      
      const context: Context = {
        recentPivotBarsAgo: 2,
      };
      
      const result = evaluateLongSetup(bar, indicators, context);
      
      expect(result.kind).toBe('押し目ロングの型');
      expect(result.pivot.isPivot).toBe(true);
      expect(result.entry.label).not.toBe('見送り');
      expect(result.verdict).toBe('推奨');
    });
  });

  describe('保留シナリオ', () => {
    it('Pivot認定 + Entry見送り → 保留', () => {
      const bar = createTestBar({
        volume: 150000, // Pivotは認定されるが
        close: 1040,    // Entryはgate落ち
      });
      
      const indicators = createTestIndicators();
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = evaluateLongSetup(bar, indicators, context);
      
      expect(result.pivot.isPivot).toBe(true);
      expect(result.entry.label).toBe('見送り');
      expect(result.verdict).toBe('保留');
    });
  });

  describe('非推奨シナリオ', () => {
    it('Pivot非認定 → 非推奨（Entryに関係なく）', () => {
      const bar = createTestBar({
        volume: 50000, // 低出来高でPivot非認定
      });
      
      const indicators = createTestIndicators({
        volMA5: 80000,
      });
      
      const context: Context = {
        recentPivotBarsAgo: 1,
      };
      
      const result = evaluateLongSetup(bar, indicators, context);
      
      expect(result.pivot.isPivot).toBe(false);
      expect(result.verdict).toBe('非推奨');
    });
  });

  describe('結果形式確認', () => {
    it('必要なフィールドがすべて含まれる', () => {
      const bar = createTestBar();
      const indicators = createTestIndicators();
      const context: Context = { recentPivotBarsAgo: 1 };
      
      const result = evaluateLongSetup(bar, indicators, context);
      
      // LongSetupResult の構造確認
      expect(result).toHaveProperty('kind', '押し目ロングの型');
      expect(result).toHaveProperty('pivot');
      expect(result).toHaveProperty('entry');
      expect(result).toHaveProperty('verdict');
      
      // Pivot結果の構造確認
      expect(result.pivot).toHaveProperty('version', 'v1.3');
      expect(result.pivot).toHaveProperty('final');
      expect(result.pivot).toHaveProperty('isPivot');
      
      // Entry結果の構造確認
      expect(result.entry).toHaveProperty('version', 'v0.4');
      expect(result.entry).toHaveProperty('gatePassed');
      expect(result.entry).toHaveProperty('scores');
      expect(result.entry).toHaveProperty('weighted');
      expect(result.entry).toHaveProperty('final');
      expect(result.entry).toHaveProperty('label');
      expect(result.entry).toHaveProperty('explain');
      expect(result.entry).toHaveProperty('details');
    });
  });
});