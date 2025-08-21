/**
 * Entry足判定 v0.4 Candle スコア計算
 *
 * ローソク足パターン認識と補正による評価
 */
import { bodyRatio, upperShadowRatio, lowerShadowRatio, calculateCLV, isBullish, isInside, isNear, safeDiv, clamp, roundTo, nz } from './utils.js';
/**
 * ブレイク系パターンの判定
 */
function isBreakoutPattern(bar, indicators, bodyRatio, upperRatio) {
    const prevHigh = nz(indicators.prevHigh);
    // ブレイク条件なし
    if (prevHigh === 0 || bar.close <= prevHigh) {
        return null;
    }
    // 1. ブレイク・マルボウズ 92点
    if (bodyRatio >= 0.60 && upperRatio <= 0.20) {
        return { pattern: 'breakout_marubozu', score: 92 };
    }
    // 2. 標準ブレイク 85点
    if (bodyRatio >= 0.40 && upperRatio <= 0.30) {
        return { pattern: 'standard_breakout', score: 85 };
    }
    return null;
}
/**
 * インサイド上放れパターンの判定
 */
function isInsideBreakoutPattern(bar, indicators) {
    const prevHigh = nz(indicators.prevHigh);
    const prevLow = nz(indicators.prevLow);
    const prev2High = nz(indicators.prev2High);
    const prev2Low = nz(indicators.prev2Low);
    // データ不足
    if (prevHigh === 0 || prev2High === 0) {
        return null;
    }
    // インサイド条件（前日が前々日に内包）
    const prevInside = isInside({ high: prevHigh, low: prevLow }, { high: prev2High, low: prev2Low });
    // 上放れ条件
    const breakout = bar.close > prevHigh;
    if (prevInside && breakout) {
        return { pattern: 'inside_breakout', score: 82 };
    }
    return null;
}
/**
 * 20MAタッチ反転パターンの判定
 */
function isMA20TouchReversalPattern(bar, indicators, lowerRatio, options) {
    const sma20 = indicators.sma20;
    // 20MA不明
    if (sma20 == null) {
        return null;
    }
    // 20MA近接 & 陽線 & 下髭十分
    const near20 = isNear(bar.close, sma20, options.nearPct20);
    const bullish = isBullish(bar.open, bar.close);
    const goodLower = lowerRatio >= 0.25;
    if (near20 && bullish && goodLower) {
        return { pattern: 'ma20_touch_reversal', score: 78 };
    }
    return null;
}
/**
 * エンガルフィング@20MAパターンの判定
 */
function isEngulfingAtMA20Pattern(bar, indicators, options) {
    const sma20 = indicators.sma20;
    const prevClose = nz(indicators.prevClose);
    // 20MA不明またはデータ不足
    if (sma20 == null || prevClose === 0) {
        return null;
    }
    // 当日陽線
    const bullish = isBullish(bar.open, bar.close);
    // 20MA近接
    const near20 = isNear(bar.close, sma20, options.nearPct20);
    // 条件が不完全なため、近似判定のみ実施
    if (bullish && near20) {
        return { pattern: 'engulfing_at_ma20', score: 76 };
    }
    return null;
}
/**
 * 続伸・小実体(HHHL)パターンの判定
 */
function isContinuationSmallBodyPattern(bar, indicators, bodyRatio) {
    const prevHigh = nz(indicators.prevHigh);
    const prevLow = nz(indicators.prevLow);
    // データ不足
    if (prevHigh === 0) {
        return null;
    }
    // HHHL条件
    const higherHigh = bar.high > prevHigh;
    const higherLow = bar.low > prevLow;
    const smallBody = bodyRatio < 0.30;
    if (higherHigh && higherLow && smallBody) {
        return { pattern: 'continuation_small_body', score: 62 };
    }
    return null;
}
/**
 * 汎用陽線パターンの判定
 */
function isGenericBullishPattern(bar, bodyRatio) {
    const bullish = isBullish(bar.open, bar.close);
    if (bullish && bodyRatio >= 0.30 && bodyRatio < 0.70) {
        return { pattern: 'generic_bullish', score: 68 };
    }
    return null;
}
/**
 * ローソク足パターンを識別して基礎点を決定
 */
function identifyPattern(bar, indicators, options) {
    const body = bodyRatio(bar.open, bar.close, bar.high, bar.low);
    const upper = upperShadowRatio(bar.open, bar.close, bar.high, bar.low);
    const lower = lowerShadowRatio(bar.open, bar.close, bar.high, bar.low);
    // 優先順位に従って判定
    // 1. ブレイク・マルボウズ / 標準ブレイク
    const breakout = isBreakoutPattern(bar, indicators, body, upper);
    if (breakout)
        return { pattern: breakout.pattern, baseScore: breakout.score };
    // 2. インサイド上放れ
    const insideBreakout = isInsideBreakoutPattern(bar, indicators);
    if (insideBreakout)
        return { pattern: insideBreakout.pattern, baseScore: insideBreakout.score };
    // 3. 20MAタッチ反転
    const ma20Touch = isMA20TouchReversalPattern(bar, indicators, lower, options);
    if (ma20Touch)
        return { pattern: ma20Touch.pattern, baseScore: ma20Touch.score };
    // 4. エンガルフィング@20MA
    const engulfing = isEngulfingAtMA20Pattern(bar, indicators, options);
    if (engulfing)
        return { pattern: engulfing.pattern, baseScore: engulfing.score };
    // 5. 続伸・小実体(HHHL)
    const continuation = isContinuationSmallBodyPattern(bar, indicators, body);
    if (continuation)
        return { pattern: continuation.pattern, baseScore: continuation.score };
    // 6. 汎用陽線
    const generic = isGenericBullishPattern(bar, body);
    if (generic)
        return { pattern: generic.pattern, baseScore: generic.score };
    // 7. その他
    return { pattern: 'other', baseScore: 30 };
}
/**
 * 補正値を計算
 */
function calculateAdjustments(pattern, upperRatio, clv, rangeRatio, gapPct) {
    let upperPenalty = 0;
    let clvAdjustment = 0;
    let rangeAdjustment = 0;
    let gapAdjustment = 0;
    // 上髭ペナルティ
    if (upperRatio > 0.35) {
        // ブレイク系は0点確定
        if (pattern === 'breakout_marubozu' || pattern === 'standard_breakout') {
            upperPenalty = -9999; // 0点にするための大きなペナルティ
        }
        else {
            upperPenalty = -25;
        }
    }
    // CLV補正（20MAタッチ反転は除外）
    if (pattern !== 'ma20_touch_reversal') {
        if (clv >= 0.70) {
            clvAdjustment = 5;
        }
        else if (clv <= 0.30) {
            clvAdjustment = -10;
        }
    }
    // レンジ拡大/縮小
    if (rangeRatio >= 1.3) {
        rangeAdjustment = 5;
    }
    else if (rangeRatio <= 0.7) {
        rangeAdjustment = -5;
    }
    // ギャップ失速
    if (gapPct >= 2.0 && clv < 0.5) {
        gapAdjustment = -20;
    }
    return {
        upperPenalty,
        clvAdjustment,
        rangeAdjustment,
        gapAdjustment,
    };
}
/**
 * Candleスコアを計算
 */
export function calculateCandleScore(bar, indicators, options) {
    // 基本比率計算
    const body = bodyRatio(bar.open, bar.close, bar.high, bar.low);
    const upper = upperShadowRatio(bar.open, bar.close, bar.high, bar.low);
    const lower = lowerShadowRatio(bar.open, bar.close, bar.high, bar.low);
    const clv = calculateCLV(bar.close, bar.high, bar.low);
    // レンジ比率（前日比）
    const prevHigh = nz(indicators.prevHigh);
    const prevLow = nz(indicators.prevLow);
    const prevRange = Math.max(1e-9, prevHigh - prevLow);
    const currentRange = Math.max(1e-9, bar.high - bar.low);
    const rangeRatio = safeDiv(currentRange, prevRange, 1.0);
    // ギャップ%
    const prevClose = nz(indicators.prevClose);
    const gapPct = prevClose > 0 ? Math.abs((bar.open - prevClose) / prevClose * 100) : 0;
    // パターン識別
    const { pattern, baseScore } = identifyPattern(bar, indicators, options);
    // 補正計算
    const adjustments = calculateAdjustments(pattern, upper, clv, rangeRatio, gapPct);
    // 最終スコア
    const totalAdjustment = adjustments.upperPenalty +
        adjustments.clvAdjustment +
        adjustments.rangeAdjustment +
        adjustments.gapAdjustment;
    const adjustedScore = clamp(0, 100, baseScore + totalAdjustment);
    return {
        pattern,
        baseScore,
        bodyRatio: roundTo(body, 3),
        upperRatio: roundTo(upper, 3),
        lowerRatio: roundTo(lower, 3),
        clv: roundTo(clv, 3),
        rangeRatio: roundTo(rangeRatio, 2),
        gapPct: roundTo(gapPct, 2),
        adjustments: {
            upperPenalty: adjustments.upperPenalty,
            clvAdjustment: adjustments.clvAdjustment,
            rangeAdjustment: adjustments.rangeAdjustment,
            gapAdjustment: adjustments.gapAdjustment,
        },
        adjustedScore: Math.round(adjustedScore),
    };
}
//# sourceMappingURL=candleScore.js.map