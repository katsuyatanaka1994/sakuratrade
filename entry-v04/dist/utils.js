/**
 * Entry足判定 v0.4 ユーティリティ関数
 *
 * 数値計算、安全な演算、クリップ等の共通処理
 */
/**
 * 値を指定範囲内にクリップ
 * @param min - 最小値
 * @param max - 最大値
 * @param value - 対象値
 * @returns クリップされた値
 */
export function clamp(min, max, value) {
    return Math.min(max, Math.max(min, value));
}
/**
 * null/undefinedを既定値に変換
 * @param value - 対象値
 * @param defaultValue - 既定値
 * @returns 有効な値または既定値
 */
export function nz(value, defaultValue = 0) {
    return value ?? defaultValue;
}
/**
 * 安全な除算（ゼロ除算防止）
 * @param numerator - 分子
 * @param denominator - 分母
 * @param fallback - 分母が0の場合の既定値
 * @returns 除算結果または既定値
 */
export function safeDiv(numerator, denominator, fallback = 0) {
    return Math.abs(denominator) > 1e-9 ? numerator / denominator : fallback;
}
/**
 * 小数を指定桁数に丸める
 * @param value - 対象値
 * @param digits - 小数桁数（既定1桁）
 * @returns 丸められた値
 */
export function roundTo(value, digits = 1) {
    const factor = Math.pow(10, digits);
    return Math.round(value * factor) / factor;
}
/**
 * 変化率を計算（%）
 * @param current - 現在値
 * @param previous - 過去値
 * @returns 変化率（%）、計算不可の場合は0
 */
export function changePercent(current, previous) {
    return safeDiv((current - previous) * 100, previous, 0);
}
/**
 * 実体比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param high - 高値
 * @param low - 安値
 * @returns 実体比率（0-1）
 */
export function bodyRatio(open, close, high, low) {
    const range = Math.max(1e-9, high - low);
    return Math.abs(close - open) / range;
}
/**
 * 上髭比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param high - 高値
 * @returns 上髭比率（0-1）
 */
export function upperShadowRatio(open, close, high, low) {
    const range = Math.max(1e-9, high - low);
    return (high - Math.max(open, close)) / range;
}
/**
 * 下髭比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param low - 安値
 * @returns 下髭比率（0-1）
 */
export function lowerShadowRatio(open, close, high, low) {
    const range = Math.max(1e-9, high - low);
    return (Math.min(open, close) - low) / range;
}
/**
 * CLV (Close Location Value) を計算
 * @param close - 終値
 * @param high - 高値
 * @param low - 安値
 * @returns CLV（0-1）
 */
export function calculateCLV(close, high, low) {
    return safeDiv(close - low, high - low, 0.5);
}
/**
 * 足が陽線かどうか判定
 * @param open - 始値
 * @param close - 終値
 * @returns 陽線の場合true
 */
export function isBullish(open, close) {
    return close > open;
}
/**
 * 足が陰線かどうか判定
 * @param open - 始値
 * @param close - 終値
 * @returns 陰線の場合true
 */
export function isBearish(open, close) {
    return close < open;
}
/**
 * インサイドバーかどうか判定
 * @param current - 現在の足
 * @param previous - 前の足
 * @returns インサイドバーの場合true
 */
export function isInside(current, previous) {
    return current.high < previous.high && current.low > previous.low;
}
/**
 * 価格が指定値に近いかどうか判定
 * @param price - 価格
 * @param target - 目標価格
 * @param thresholdPct - 閾値（%）
 * @returns 近い場合true
 */
export function isNear(price, target, thresholdPct) {
    if (target === 0)
        return false;
    return Math.abs(price - target) / Math.abs(target) <= thresholdPct;
}
//# sourceMappingURL=utils.js.map