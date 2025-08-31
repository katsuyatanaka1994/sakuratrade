/**
 * Pivot足判定ロジック v1.3 設定ファイル
 *
 * 将来的にJSONファイル化する場合に備えて、型定義と既定値を分離可能な構造で定義
 */
/**
 * Pivot足判定 v1.3 の既定設定
 */
export const defaultConfig = {
    version: 'v1.3',
    weights: {
        candle: 0.25, // 25%
        location: 0.35, // 35%
        slope: 0.20, // 20%
        volume: 0.20, // 20%
    },
    thresholds: {
        final: 65, // 65点以上でPivot認定
        nearPct: 0.01, // 1%以内でMA近接
        slopePct: 0.5, // 0.5%で傾き上下判定（パーセント表示）
    },
    priceBands: {
        small: 3000, // 3,000円未満 = 小型株
        mid: 10000, // 10,000円未満 = 中型株（以上は値嵩株）
    },
    locationTable: {
        small: { '20': 100, '60': 70, both: 85, none: 0 },
        mid: { '20': 90, '60': 60, both: 75, none: 0 },
        large: { '20': 80, '60': 50, both: 65, none: 0 },
    },
    slopeScores: {
        sma20: { up: 100, flat: 60, down: 0 },
        sma60: { up: 70, flat: 50, down: 30 },
        weights: { sma20: 0.7, sma60: 0.3 },
    },
    volumeScore: {
        fullScoreMultiplier: 1.5, // 5日平均の1.5倍で100点
    },
};
/**
 * 現在の設定を取得（将来的にJSON読込等に差し替え可能）
 */
export function getConfig() {
    return defaultConfig;
}
//# sourceMappingURL=config.js.map