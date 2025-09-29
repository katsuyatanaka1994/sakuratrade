/**
 * Pivot足判定ロジック v1.3 使用例
 * 
 * このサンプルファイルでは、実際のトレードデータでのPivot判定を実演します。
 */

import { scorePivot } from './dist/index.js';

console.log('=== Pivot足判定ロジック v1.3 デモ ===\n');

// サンプル1: 中型株・中陽線・20MA近接・上向き傾き → Pivot認定期待
const sample1 = {
  date: '2024-01-15',
  open: 5000,
  high: 5300,
  low: 4950,
  close: 5200,      // 中型株
  volume: 150000,
  volMA5: 100000,   // 1.5倍の出来高
  sma20: 5150,      // 1%以内で近接
  sma60: 5000,
  sma20_5ago: 5100, // 1%上昇
  sma60_5ago: 4980, // 0.4%上昇
};

console.log('📊 サンプル1: 中型・中陽線・20MA近接・上向き');
const result1 = scorePivot(sample1);
console.log(`最終スコア: ${result1.final}点`);
console.log(`判定: ${result1.isPivot ? '✅ Pivot認定' : '❌ 非認定'}`);
console.log(`内訳: C${result1.scores.candle} L${result1.scores.location} S${result1.scores.slope} V${result1.scores.volume}`);
console.log();

// サンプル2: 小型株・カラカサ陽線・20&60MA近接
const sample2 = {
  date: '2024-01-16', 
  open: 2100,
  high: 2120,
  low: 1900,        // 大きな下影
  close: 2000,      // 小型株・陽線
  volume: 120000,
  volMA5: 100000,   // 1.2倍
  sma20: 2010,      // 近接
  sma60: 1990,      // 近接
  sma20_5ago: 2008, // 0.1%横ばい
  sma60_5ago: 1988, // 0.1%横ばい
};

console.log('📊 サンプル2: 小型・カラカサ陽線・20&60MA近接・横ばい');
const result2 = scorePivot(sample2);
console.log(`最終スコア: ${result2.final}点`);
console.log(`判定: ${result2.isPivot ? '✅ Pivot認定' : '❌ 非認定'}`);
console.log(`内訳: C${result2.scores.candle} L${result2.scores.location} S${result2.scores.slope} V${result2.scores.volume}`);
console.log();

// サンプル3: 値嵩株・陰線・MA非近接・下降傾向 → 非認定期待
const sample3 = {
  date: '2024-01-17',
  open: 12020,
  high: 12030,
  low: 12005,
  close: 12010,     // 値嵩株・陰線
  volume: 30000,
  volMA5: 100000,   // 0.3倍の低出来高
  sma20: 11800,     // 非近接
  sma60: 12015,     // 近接
  sma20_5ago: 12000,// -1.7%下降
  sma60_5ago: 12020,// -0.04%横ばい
};

console.log('📊 サンプル3: 値嵩・陰線コマ・60MA近接・20MA下向き・低出来高');
const result3 = scorePivot(sample3);
console.log(`最終スコア: ${result3.final}点`);
console.log(`判定: ${result3.isPivot ? '✅ Pivot認定' : '❌ 非認定'}`);
console.log(`内訳: C${result3.scores.candle} L${result3.scores.location} S${result3.scores.slope} V${result3.scores.volume}`);
console.log();

// 詳細な説明も表示
console.log('=== サンプル1の詳細分析 ===');
console.log(result1.explain);