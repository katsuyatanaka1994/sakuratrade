/**
 * Pivot足判定ロジック v1.3 ユニットテスト
 */

import { describe, it, expect } from 'vitest';
import {
  scorePivot,
  candleScore,
  locationScore,
  slopeScore,
  volumeScore,
  getPriceBand,
  type PivotInput
} from '../src/index.js';

describe('Pivot足判定ロジック v1.3', () => {
  
  describe('candleScore', () => {
    it('カラカサ陽線（下影30%以上・上髭小）は90点', () => {
      // 下影比率 = (min(open,close) - low) / (high - low)
      // 下影30%の陽線：low=70, open=85, close=90, high=92（上髭を小さく） 
      // 下影比率 = (85 - 70) / (92 - 70) = 15/22 = 0.68 (68% ≥ 30%)
      // 上髭比率 = (92 - 90) / (92 - 70) = 2/22 = 0.09 (9% < 30%)
      expect(candleScore(85, 92, 70, 90)).toBe(90);
    });
    
    it('上髭陽線（トンカチ、上髭30%以上）は0点', () => {
      // 上髭比率 = (high - max(open,close)) / (high - low)
      // 上髭30%の陽線：low=70, open=80, close=85, high=100
      // 上髭比率 = (100 - 85) / (100 - 70) = 15/30 = 0.5 (50% ≥ 30%)
      expect(candleScore(80, 100, 70, 85)).toBe(0);
    });
    
    it('大陽線（実体70%以上）は80点', () => {
      // 実体率 = |close - open| / (high - low)
      // 実体70%の陽線：low=70, open=75, close=96, high=100
      // 実体率 = |96 - 75| / (100 - 70) = 21/30 = 0.7 (70%)
      expect(candleScore(75, 100, 70, 96)).toBe(80);
    });
    
    it('下影陰線（下影30%以上）は65点', () => {
      // 下影30%の陰線：low=70, open=90, close=85, high=100
      // 下影比率 = (85 - 70) / (100 - 70) = 15/30 = 0.5 (50% ≥ 30%)
      expect(candleScore(90, 100, 70, 85)).toBe(65);
    });
  });
  
  describe('getPriceBand', () => {
    it('3,000円未満は小型株', () => {
      expect(getPriceBand(2999)).toBe('small');
    });
    
    it('3,000円以上10,000円未満は中型株', () => {
      expect(getPriceBand(3000)).toBe('mid');
      expect(getPriceBand(9999)).toBe('mid');
    });
    
    it('10,000円以上は値嵩株', () => {
      expect(getPriceBand(10000)).toBe('large');
    });
  });
  
  describe('locationScore', () => {
    it('小型株の20MA近接は100点', () => {
      const result = locationScore(2500, 2525, null); // 2500に対して2525（1%以内）
      expect(result.score).toBe(100);
      expect(result.band).toBe('small');
      expect(result.near20).toBe(true);
      expect(result.near60).toBe(false);
    });
    
    it('中型株の20&60MA近接は75点', () => {
      const result = locationScore(5000, 5025, 4975); // 両方1%以内
      expect(result.score).toBe(75);
      expect(result.band).toBe('mid');
      expect(result.near20).toBe(true);
      expect(result.near60).toBe(true);
    });
    
    it('値嵩株でMA非近接は0点', () => {
      const result = locationScore(15000, 14000, 16000); // どちらも1%超
      expect(result.score).toBe(0);
      expect(result.band).toBe('large');
      expect(result.near20).toBe(false);
      expect(result.near60).toBe(false);
    });
  });
  
  describe('slopeScore', () => {
    it('20MA上向き・60MA横ばいの合成スコア', () => {
      // 20MA: 100 → 101 (1%上昇) → 上向き100点
      // 60MA: 100 → 100.3 (0.3%上昇) → 横ばい50点
      // 合成: 0.7 * 100 + 0.3 * 50 = 70 + 15 = 85点
      const result = slopeScore(101, 100, 100.3, 100);
      expect(result.score).toBe(85);
      expect(result.s20pct).toBe(1.0);
      expect(result.s60pct).toBe(0.3);
    });
  });
  
  describe('volumeScore', () => {
    it('5日平均の1.5倍で100点', () => {
      expect(volumeScore(1500, 1000)).toBe(100);
    });
    
    it('5日平均の0.75倍で50点', () => {
      expect(volumeScore(750, 1000)).toBe(50);
    });
    
    it('5日平均の3倍でも100点上限クリップ', () => {
      expect(volumeScore(3000, 1000)).toBe(100);
    });
  });
  
  describe('scorePivot 総合テスト', () => {
    
    it('ケース1: 中型・中陽線・20MA近接・20MA上向き → 高スコアでPivot認定', () => {
      const input: PivotInput = {
        date: '2024-01-15',
        open: 5000,
        high: 5300,
        low: 4950,
        close: 5200,  // 中型株
        volume: 150000,
        volMA5: 100000,  // 1.5倍の出来高
        sma20: 5150,     // 近接（1%以内）
        sma60: 5000,
        sma20_5ago: 5100, // 1%上昇
        sma60_5ago: 4980, // 0.4%上昇（横ばい）
      };
      
      const result = scorePivot(input);
      
      // 期待値の範囲チェック
      expect(result.scores.candle).toBe(70);     // 中陽線
      expect(result.scores.location).toBe(90);   // 中型・20MA近接
      expect(result.scores.slope).toBeGreaterThanOrEqual(80);  // 20MA上向き主体
      expect(result.scores.volume).toBe(100);    // 1.5倍出来高
      
      expect(result.final).toBeGreaterThanOrEqual(75);
      expect(result.final).toBeLessThanOrEqual(90);
      expect(result.isPivot).toBe(true);
      expect(result.meta.version).toBe('v1.3');
    });
    
    it('ケース2: 小型・下影陰線・20&60近接・横ばい → ボーダー認定', () => {
      const input: PivotInput = {
        date: '2024-01-16',
        open: 2100,
        high: 2150,
        low: 1900,       // 大きな下影
        close: 2000,     // 小型株・陰線
        volume: 80000,
        volMA5: 100000,  // 0.8倍の出来高
        sma20: 2010,     // 近接
        sma60: 1990,     // 近接
        sma20_5ago: 2008, // 0.1%上昇（横ばい）
        sma60_5ago: 1988, // 0.1%上昇（横ばい）
      };
      
      const result = scorePivot(input);
      
      expect(result.scores.candle).toBe(65);     // 下影陰線
      expect(result.scores.location).toBe(85);   // 小型・20&60近接
      expect(result.scores.slope).toBeGreaterThanOrEqual(55);  // 横ばい主体
      expect(result.scores.volume).toBeLessThanOrEqual(55);    // 0.8倍出来高
      
      // ボーダーライン判定
      expect(result.final).toBeGreaterThanOrEqual(60);
      expect(result.final).toBeLessThanOrEqual(75);
    });
    
    it('ケース3: 値嵩・陰線コマ・60MA近接・20MA下向き・低出来高 → 非認定', () => {
      const input: PivotInput = {
        date: '2024-01-17',
        open: 12020,
        high: 12030,     
        low: 12005,      // 下影を小さく      
        close: 12010,    // 陰線（コマ扱いで20点）
        volume: 30000,
        volMA5: 100000,  // 0.3倍の低出来高
        sma20: 11800,    // 非近接
        sma60: 12015,    // 近接
        sma20_5ago: 12000, // -1.7%下降
        sma60_5ago: 12020, // 0.04%横ばい
      };
      
      const result = scorePivot(input);
      
      expect(result.scores.candle).toBe(20);     // 陰線コマ
      expect(result.scores.location).toBe(50);   // 値嵩・60MA近接
      expect(result.scores.slope).toBeLessThanOrEqual(40);    // 20MA下向き影響
      expect(result.scores.volume).toBeLessThanOrEqual(25);   // 0.3倍低出来高
      
      expect(result.final).toBeLessThan(65);
      expect(result.isPivot).toBe(false);
    });
  });
  
  describe('エッジケース', () => {
    it('MA未定義でもエラーにならない', () => {
      const input: PivotInput = {
        date: '2024-01-01',
        open: 1000,
        high: 1100,
        low: 950,
        close: 1050,
        volume: 50000,
        volMA5: 60000,
        // MA系はすべて未定義
      };
      
      const result = scorePivot(input);
      expect(result.scores.location).toBe(0);    // MA非近接
      expect(result.scores.slope).toBe(57);      // 傾き計算不可→横ばい扱い（0.7*60 + 0.3*50 = 57）
      expect(result.meta.near20).toBe(false);
      expect(result.meta.near60).toBe(false);
      expect(result.meta.slope20pct).toBe(0);
      expect(result.meta.slope60pct).toBe(0);
    });
    
    it('high=lowでもゼロ除算エラーにならない', () => {
      const input: PivotInput = {
        date: '2024-01-01',
        open: 1000,
        high: 1000,  // high = low
        low: 1000,
        close: 1000,
        volume: 50000,
        volMA5: 60000,
      };
      
      // ゼロ除算防止により計算可能
      expect(() => scorePivot(input)).not.toThrow();
    });
  });
});