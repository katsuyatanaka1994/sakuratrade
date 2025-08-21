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
export declare function clamp(min: number, max: number, value: number): number;
/**
 * null/undefinedを既定値に変換
 * @param value - 対象値
 * @param defaultValue - 既定値
 * @returns 有効な値または既定値
 */
export declare function nz(value: number | null | undefined, defaultValue?: number): number;
/**
 * 安全な除算（ゼロ除算防止）
 * @param numerator - 分子
 * @param denominator - 分母
 * @param fallback - 分母が0の場合の既定値
 * @returns 除算結果または既定値
 */
export declare function safeDiv(numerator: number, denominator: number, fallback?: number): number;
/**
 * 小数を指定桁数に丸める
 * @param value - 対象値
 * @param digits - 小数桁数（既定1桁）
 * @returns 丸められた値
 */
export declare function roundTo(value: number, digits?: number): number;
/**
 * 変化率を計算（%）
 * @param current - 現在値
 * @param previous - 過去値
 * @returns 変化率（%）、計算不可の場合は0
 */
export declare function changePercent(current: number, previous: number): number;
/**
 * 実体比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param high - 高値
 * @param low - 安値
 * @returns 実体比率（0-1）
 */
export declare function bodyRatio(open: number, close: number, high: number, low: number): number;
/**
 * 上髭比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param high - 高値
 * @returns 上髭比率（0-1）
 */
export declare function upperShadowRatio(open: number, close: number, high: number, low: number): number;
/**
 * 下髭比率を計算
 * @param open - 始値
 * @param close - 終値
 * @param low - 安値
 * @returns 下髭比率（0-1）
 */
export declare function lowerShadowRatio(open: number, close: number, high: number, low: number): number;
/**
 * CLV (Close Location Value) を計算
 * @param close - 終値
 * @param high - 高値
 * @param low - 安値
 * @returns CLV（0-1）
 */
export declare function calculateCLV(close: number, high: number, low: number): number;
/**
 * 足が陽線かどうか判定
 * @param open - 始値
 * @param close - 終値
 * @returns 陽線の場合true
 */
export declare function isBullish(open: number, close: number): boolean;
/**
 * 足が陰線かどうか判定
 * @param open - 始値
 * @param close - 終値
 * @returns 陰線の場合true
 */
export declare function isBearish(open: number, close: number): boolean;
/**
 * インサイドバーかどうか判定
 * @param current - 現在の足
 * @param previous - 前の足
 * @returns インサイドバーの場合true
 */
export declare function isInside(current: {
    high: number;
    low: number;
}, previous: {
    high: number;
    low: number;
}): boolean;
/**
 * 価格が指定値に近いかどうか判定
 * @param price - 価格
 * @param target - 目標価格
 * @param thresholdPct - 閾値（%）
 * @returns 近い場合true
 */
export declare function isNear(price: number, target: number, thresholdPct: number): boolean;
//# sourceMappingURL=utils.d.ts.map