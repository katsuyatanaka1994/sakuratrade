/**
 * Entry足判定 v0.4 Volume スコア計算
 *
 * 出来高による評価
 */
import { nz, safeDiv, roundTo } from './utils.js';
/**
 * Volumeスコアを計算（0-100）
 * @param bar - 足データ
 * @param indicators - テクニカル指標
 * @returns 出来高スコア詳細
 */
export function calculateVolumeScore(bar, indicators) {
    const volume = bar.volume;
    const volMA5 = nz(indicators.volMA5, 1); // 0除算防止のため最低1
    // 出来高倍率
    const volumeRatio = safeDiv(volume, volMA5, 0);
    // スコア計算：min(100, 100 × volume / (1.5 × volMA5))
    const score = Math.min(100, 100 * volumeRatio / 1.5);
    return {
        volumeRatio: roundTo(volumeRatio, 2),
        score: Math.round(score),
    };
}
//# sourceMappingURL=volumeScore.js.map