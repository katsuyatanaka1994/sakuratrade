/**
 * Pivot足判定ロジック v1.3 コア実装
 *
 * 押し目ロングのPivot足を判定する純関数群とメイン関数
 * すべての関数は副作用なし・不変データを返却
 */
import { getConfig } from './config.js';
/**
 * 小数を指定桁数に丸める
 * @param value - 対象値
 * @param digits - 小数桁数（既定1桁）
 * @returns 丸めた値
 */
function roundTo(value, digits = 1) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}
/**
 * 安全な除算（ゼロ除算防止）
 * @param numerator - 分子
 * @param denominator - 分母
 * @param fallback - 分母が0の場合の既定値
 * @returns 除算結果
 */
function safeDivide(numerator, denominator, fallback = 0) {
    return denominator !== 0 ? numerator / denominator : fallback;
}
/**
 * Candleスコアを計算（0-100）
 *
 * @param open - 始値
 * @param high - 高値
 * @param low - 安値
 * @param close - 終値
 * @returns Candleスコア（0-100の整数）
 */
export function candleScore(open, high, low, close) {
    // 0除算防止
    const range = Math.max(1e-9, high - low);
    // 実体率、上髭比率、下影比率を計算
    const body = Math.abs(close - open) / range;
    const upper = (high - Math.max(open, close)) / range;
    const lower = (Math.min(open, close) - low) / range;
    const isPositive = close > open;
    // 足形判定ロジック（仕様の順序通り）
    if (isPositive && upper >= 0.30)
        return 0; // 上髭陽線（トンカチ）
    if (!isPositive && body >= 0.90)
        return 0; // 丸坊主陰線
    if (isPositive && lower >= 0.30)
        return 90; // カラカサ陽線
    if (!isPositive && lower >= 0.30)
        return 65; // 下影陰線
    if (isPositive && body >= 0.70)
        return 80; // 大陽線
    if (isPositive && body > 0.30 && body < 0.70)
        return 70; // 中陽線
    if (isPositive && body <= 0.30)
        return 40; // 小陽線/コマ
    // その他の陰線（陰線コマ）
    return 20;
}
/**
 * 株価帯を判定
 * @param close - 終値
 * @returns 株価帯
 */
export function getPriceBand(close) {
    const config = getConfig();
    if (close < config.priceBands.small)
        return 'small';
    if (close < config.priceBands.mid)
        return 'mid';
    return 'large';
}
/**
 * Locationスコアを計算（0-100）
 *
 * @param close - 終値
 * @param sma20 - 20日移動平均（未定義可）
 * @param sma60 - 60日移動平均（未定義可）
 * @returns ロケーション計算結果
 */
export function locationScore(close, sma20, sma60) {
    const config = getConfig();
    const band = getPriceBand(close);
    // MA近接判定
    const near20 = sma20 != null && Math.abs(close - sma20) / Math.max(1, close) <= config.thresholds.nearPct;
    const near60 = sma60 != null && Math.abs(close - sma60) / Math.max(1, close) <= config.thresholds.nearPct;
    // スコア取得
    let score;
    if (near20 && near60) {
        score = config.locationTable[band].both;
    }
    else if (near20) {
        score = config.locationTable[band]['20'];
    }
    else if (near60) {
        score = config.locationTable[band]['60'];
    }
    else {
        score = config.locationTable[band].none;
    }
    return {
        score,
        near20,
        near60,
        band,
    };
}
/**
 * 傾きの方向を判定
 * @param slopePct - 傾き（%）
 * @returns 'up' | 'flat' | 'down'
 */
function getSlopeDirection(slopePct) {
    const config = getConfig();
    if (slopePct >= config.thresholds.slopePct)
        return 'up';
    if (slopePct <= -config.thresholds.slopePct)
        return 'down';
    return 'flat';
}
/**
 * Slopeスコアを計算（0-100）
 *
 * @param sma20 - 現在の20日移動平均
 * @param sma20_5ago - 5日前の20日移動平均
 * @param sma60 - 現在の60日移動平均
 * @param sma60_5ago - 5日前の60日移動平均
 * @returns 傾き計算結果
 */
export function slopeScore(sma20, sma20_5ago, sma60, sma60_5ago) {
    const config = getConfig();
    // 傾き%を計算（ゼロ除算防止）
    const s20pct = sma20 != null && sma20_5ago != null && sma20_5ago > 0
        ? ((sma20 - sma20_5ago) / sma20_5ago) * 100
        : 0;
    const s60pct = sma60 != null && sma60_5ago != null && sma60_5ago > 0
        ? ((sma60 - sma60_5ago) / sma60_5ago) * 100
        : 0;
    // 各MAのスコア計算
    const dir20 = getSlopeDirection(s20pct);
    const dir60 = getSlopeDirection(s60pct);
    const score20 = config.slopeScores.sma20[dir20];
    const score60 = config.slopeScores.sma60[dir60];
    // 重み付け合成
    const score = config.slopeScores.weights.sma20 * score20 + config.slopeScores.weights.sma60 * score60;
    return {
        score: Math.round(score), // 整数に丸め
        s20pct: roundTo(s20pct, 2), // 傾き%は小数2桁
        s60pct: roundTo(s60pct, 2),
    };
}
/**
 * Volumeスコアを計算（0-100）
 *
 * @param volume - 出来高
 * @param volMA5 - 5日平均出来高
 * @returns 出来高スコア（0-100の整数）
 */
export function volumeScore(volume, volMA5) {
    const config = getConfig();
    const threshold = Math.max(1, volMA5) * config.volumeScore.fullScoreMultiplier;
    const score = (volume / threshold) * 100;
    return Math.min(100, Math.round(score));
}
/**
 * メインのPivot足判定関数
 *
 * @param input - 入力データ
 * @returns Pivot判定結果
 */
export function scorePivot(input) {
    const config = getConfig();
    // 各サブスコア計算
    const candleScoreValue = candleScore(input.open, input.high, input.low, input.close);
    const locationResult = locationScore(input.close, input.sma20, input.sma60);
    const slopeResult = slopeScore(input.sma20, input.sma20_5ago, input.sma60, input.sma60_5ago);
    const volumeScoreValue = volumeScore(input.volume, input.volMA5);
    // 重み付け寄与計算
    const weightedCandle = roundTo(candleScoreValue * config.weights.candle);
    const weightedLocation = roundTo(locationResult.score * config.weights.location);
    const weightedSlope = roundTo(slopeResult.score * config.weights.slope);
    const weightedVolume = roundTo(volumeScoreValue * config.weights.volume);
    // 最終スコア
    const final = roundTo(weightedCandle + weightedLocation + weightedSlope + weightedVolume);
    // Pivot判定
    const isPivot = final >= config.thresholds.final;
    // 説明文字列生成
    const explain = generateExplanation({
        candle: candleScoreValue,
        location: locationResult.score,
        slope: slopeResult.score,
        volume: volumeScoreValue,
    }, {
        candle: weightedCandle,
        location: weightedLocation,
        slope: weightedSlope,
        volume: weightedVolume,
    }, final, isPivot, {
        band: locationResult.band,
        near20: locationResult.near20,
        near60: locationResult.near60,
        slope20pct: slopeResult.s20pct,
        slope60pct: slopeResult.s60pct,
    });
    return {
        scores: {
            candle: candleScoreValue,
            location: locationResult.score,
            slope: slopeResult.score,
            volume: volumeScoreValue,
        },
        weighted: {
            candle: weightedCandle,
            location: weightedLocation,
            slope: weightedSlope,
            volume: weightedVolume,
        },
        final,
        isPivot,
        explain,
        meta: {
            priceBand: locationResult.band,
            near20: locationResult.near20,
            near60: locationResult.near60,
            slope20pct: slopeResult.s20pct,
            slope60pct: slopeResult.s60pct,
            version: config.version,
        },
    };
}
/**
 * 説明文字列を生成
 */
function generateExplanation(scores, weighted, final, isPivot, meta) {
    const config = getConfig();
    const bandNames = { small: '小型株', mid: '中型株', large: '値嵩株' };
    const nearText = meta.near20 && meta.near60 ? '20&60MA近接'
        : meta.near20 ? '20MA近接'
            : meta.near60 ? '60MA近接'
                : 'MA非近接';
    const lines = [
        `=== Pivot足判定 ${config.version} ===`,
        `Candle: ${scores.candle}点 → 寄与 ${weighted.candle}点 (重み${(config.weights.candle * 100).toFixed(0)}%)`,
        `Location: ${scores.location}点 → 寄与 ${weighted.location}点 (重み${(config.weights.location * 100).toFixed(0)}%)`,
        `Slope: ${scores.slope}点 → 寄与 ${weighted.slope}点 (重み${(config.weights.slope * 100).toFixed(0)}%)`,
        `Volume: ${scores.volume}点 → 寄与 ${weighted.volume}点 (重み${(config.weights.volume * 100).toFixed(0)}%)`,
        ``,
        `最終スコア: ${final}点`,
        `判定: ${isPivot ? 'Pivot認定' : '非認定'} (閾値${config.thresholds.final}点)`,
        ``,
        `株価帯: ${bandNames[meta.band]} | ${nearText}`,
        `20MA傾き: ${meta.slope20pct >= 0 ? '+' : ''}${meta.slope20pct}%`,
        `60MA傾き: ${meta.slope60pct >= 0 ? '+' : ''}${meta.slope60pct}%`,
    ];
    return lines.join('\n');
}
//# sourceMappingURL=pivotScore.js.map