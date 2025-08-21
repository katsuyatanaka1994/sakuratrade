/**
 * Entry足判定 v0.4 MA スコア計算
 *
 * 移動平均線の並び・傾きを評価してスコア化
 */
import type { Indicators, MAScoreDetails, Options } from './types.js';
/**
 * MAスコアを計算（並び・傾き 0-100）
 * @param indicators - テクニカル指標
 * @param options - オプション設定
 * @returns MAスコア詳細
 */
export declare function calculateMAScore(indicators: Indicators, options: Options): MAScoreDetails;
/**
 * MAスコア詳細から最終スコアを取得
 * @param details - MAスコア詳細
 * @returns 最終スコア（0-100）
 */
export declare function getMAFinalScore(details: MAScoreDetails): number;
//# sourceMappingURL=maScore.d.ts.map