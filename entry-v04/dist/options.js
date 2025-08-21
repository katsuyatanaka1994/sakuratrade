/**
 * Entry足判定 v0.4 設定・オプション
 *
 * デフォルト値と設定マージ機能を提供
 */
/** デフォルトオプション */
export const defaultOptions = {
    // Gate
    pivotLookbackBars: 4,
    allowEpsilonOnSMA5: 0.0,
    // Slope thresholds (% over 5 bars)
    slopePct: 0.5,
    // Location proximity for 20MA (Candle scoring)
    nearPct20: 0.01, // ±1%
    // Weights (Entry)
    wMA: 0.50,
    wCandle: 0.35,
    wVolume: 0.15,
    // Labels & cutoffs
    entryCutoff: 70,
    strongCutoff: 85,
};
/**
 * オプションをマージする
 * @param overrides - 上書き設定
 * @returns マージされた設定
 */
export function mergeOptions(overrides) {
    return { ...defaultOptions, ...overrides };
}
/**
 * 重みの合計チェック
 * @param options - チェック対象のオプション
 * @returns 重みの合計が1.0に近い場合true
 */
export function validateWeights(options) {
    const total = options.wMA + options.wCandle + options.wVolume;
    return Math.abs(total - 1.0) < 1e-6;
}
//# sourceMappingURL=options.js.map