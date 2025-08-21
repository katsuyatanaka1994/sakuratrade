/**
 * Entry足判定 v0.4 使用例
 */

import { scoreEntryV04, evaluateLongSetup } from './dist/index.js';

// テストデータ
const bar = {
  date: '2024-01-15',
  open: 1000,
  high: 1120,
  low: 980,
  close: 1110,
  volume: 150000,
};

const indicators = {
  sma5: 1050,
  sma20: 1000,
  sma60: 950,
  sma5_5ago: 1030,
  sma20_5ago: 980,
  sma60_5ago: 940,
  volMA5: 100000,
  prevHigh: 1070,
  prevLow: 970,
  prevClose: 1020,
};

const context = {
  recentPivotBarsAgo: 2,
};

console.log('=== Entry足判定 v0.4 使用例 ===\n');

// 1. Entry単体判定
console.log('1. Entry単体判定:');
const entryResult = scoreEntryV04(bar, indicators, context);
console.log(`ゲート通過: ${entryResult.gatePassed}`);
console.log(`スコア: MA=${entryResult.scores.MA}, Candle=${entryResult.scores.Candle}, Volume=${entryResult.scores.Volume}`);
console.log(`最終: ${entryResult.final}点 (${entryResult.label})`);
console.log(`説明: ${entryResult.explain}\n`);

// 2. 押し目ロング統合判定
console.log('2. 押し目ロング統合判定:');
const longResult = evaluateLongSetup(bar, indicators, context);
console.log(`Pivot: ${longResult.pivot.final}点 (${longResult.pivot.isPivot ? '認定' : '非認定'})`);
console.log(`Entry: ${longResult.entry.final}点 (${longResult.entry.label})`);
console.log(`総合判定: ${longResult.verdict}\n`);

// 3. 詳細情報
console.log('3. 詳細情報:');
if (longResult.entry.details.candle) {
  console.log(`Candleパターン: ${longResult.entry.details.candle.pattern}`);
  console.log(`実体比率: ${longResult.entry.details.candle.bodyRatio}`);
  console.log(`上髭比率: ${longResult.entry.details.candle.upperRatio}`);
}

if (longResult.entry.details.ma) {
  console.log(`MA並び: ${longResult.entry.details.ma.isProperArrangement ? '順調' : '混在'}`);
  console.log(`傾き: 5MA=${longResult.entry.details.ma.sma5SlopePct}%, 20MA=${longResult.entry.details.ma.sma20SlopePct}%, 60MA=${longResult.entry.details.ma.sma60SlopePct}%`);
}

if (longResult.entry.details.volume) {
  console.log(`出来高倍率: ${longResult.entry.details.volume.volumeRatio}×`);
}