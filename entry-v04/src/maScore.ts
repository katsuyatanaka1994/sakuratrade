/**
 * Entry足判定 v0.4 MA スコア計算
 * 
 * 移動平均線の並び・傾きを評価してスコア化
 */

import type { Indicators, SlopeDirection, MAScoreDetails, Options } from './types.js';
import { nz, changePercent, clamp, roundTo } from './utils.js';

/**
 * 傾きの方向を判定
 * @param slopePct - 傾き（%）
 * @param thresholdPct - 判定閾値（%）
 * @returns 傾きの方向
 */
function getSlopeDirection(slopePct: number, thresholdPct: number): SlopeDirection {
  if (slopePct >= thresholdPct) return 'up';
  if (slopePct <= -thresholdPct) return 'down';
  return 'flat';
}

/**
 * 各MAの傾きスコアを計算
 * @param direction - 傾きの方向
 * @param maType - MA種別（5/20/60）
 * @returns スコア（0-100）
 */
function getSlopeScore(direction: SlopeDirection, maType: '5' | '20' | '60'): number {
  const scoreTable = {
    '5': { up: 80, flat: 50, down: 20 },
    '20': { up: 100, flat: 60, down: 0 },
    '60': { up: 80, flat: 55, down: 25 },
  };
  
  return scoreTable[maType][direction];
}

/**
 * MAスコアを計算（並び・傾き 0-100）
 * @param indicators - テクニカル指標
 * @param options - オプション設定
 * @returns MAスコア詳細
 */
export function calculateMAScore(indicators: Indicators, options: Options): MAScoreDetails {
  // 現在値の取得（null安全）
  const sma5 = nz(indicators.sma5);
  const sma20 = nz(indicators.sma20);
  const sma60 = nz(indicators.sma60);
  
  // 5日前値の取得
  const sma5_5ago = nz(indicators.sma5_5ago);
  const sma20_5ago = nz(indicators.sma20_5ago);
  const sma60_5ago = nz(indicators.sma60_5ago);
  
  // 傾き%計算
  const sma5SlopePct = changePercent(sma5, sma5_5ago);
  const sma20SlopePct = changePercent(sma20, sma20_5ago);
  const sma60SlopePct = changePercent(sma60, sma60_5ago);
  
  // 傾き方向判定
  const dir5 = getSlopeDirection(sma5SlopePct, options.slopePct);
  const dir20 = getSlopeDirection(sma20SlopePct, options.slopePct);
  const dir60 = getSlopeDirection(sma60SlopePct, options.slopePct);
  
  // 各MAのスコア計算
  const sma5Score = getSlopeScore(dir5, '5');
  const sma20Score = getSlopeScore(dir20, '20');
  const sma60Score = getSlopeScore(dir60, '60');
  
  // 合成：0.1×S5 + 0.6×S20 + 0.3×S60
  const slopeScore = 0.1 * sma5Score + 0.6 * sma20Score + 0.3 * sma60Score;
  
  // 並びボーナス：sma20 > sma60 ? +10 : 0
  const isProperArrangement = indicators.sma20 != null && 
                               indicators.sma60 != null && 
                               indicators.sma20 > indicators.sma60;
  const arrangementBonus = isProperArrangement ? 10 : 0;
  
  return {
    sma5Score,
    sma20Score,
    sma60Score,
    slopeScore: roundTo(slopeScore),
    arrangementBonus,
    sma5SlopePct: roundTo(sma5SlopePct, 2),
    sma20SlopePct: roundTo(sma20SlopePct, 2),
    sma60SlopePct: roundTo(sma60SlopePct, 2),
    isProperArrangement,
  };
}

/**
 * MAスコア詳細から最終スコアを取得
 * @param details - MAスコア詳細
 * @returns 最終スコア（0-100）
 */
export function getMAFinalScore(details: MAScoreDetails): number {
  return Math.round(clamp(0, 100, details.slopeScore + details.arrangementBonus));
}