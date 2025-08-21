/**
 * Entry足判定 v0.4 Volume スコア計算
 *
 * 出来高による評価
 */
import type { Bar, Indicators, VolumeScoreDetails } from './types.js';
/**
 * Volumeスコアを計算（0-100）
 * @param bar - 足データ
 * @param indicators - テクニカル指標
 * @returns 出来高スコア詳細
 */
export declare function calculateVolumeScore(bar: Bar, indicators: Indicators): VolumeScoreDetails;
//# sourceMappingURL=volumeScore.d.ts.map