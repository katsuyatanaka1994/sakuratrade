/**
 * Entry足判定 v0.4 設定・オプション
 *
 * デフォルト値と設定マージ機能を提供
 */
import type { Options } from './types.js';
/** デフォルトオプション */
export declare const defaultOptions: Options;
/**
 * オプションをマージする
 * @param overrides - 上書き設定
 * @returns マージされた設定
 */
export declare function mergeOptions(overrides?: Partial<Options>): Options;
/**
 * 重みの合計チェック
 * @param options - チェック対象のオプション
 * @returns 重みの合計が1.0に近い場合true
 */
export declare function validateWeights(options: Options): boolean;
//# sourceMappingURL=options.d.ts.map