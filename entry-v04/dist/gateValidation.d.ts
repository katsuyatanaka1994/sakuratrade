/**
 * Entry足判定 v0.4 ゲート検証
 *
 * エントリー条件のゲート判定
 */
import type { Indicators, Context, Options } from './types.js';
/**
 * ゲート検証結果
 */
export type GateValidationResult = {
    /** 全体でゲート通過したか */
    passed: boolean;
    /** 個別チェック結果 */
    checks: {
        pivotExpiry: {
            passed: boolean;
            reason?: string;
        };
        priceLocation: {
            passed: boolean;
            reason?: string;
        };
    };
    /** 失敗理由一覧 */
    failures: string[];
};
/**
 * ゲート検証を実行
 * @param close - 終値
 * @param indicators - テクニカル指標
 * @param context - コンテキスト
 * @param options - オプション
 * @returns 検証結果
 */
export declare function validateGate(close: number, indicators: Indicators, context: Context, options: Options): GateValidationResult;
//# sourceMappingURL=gateValidation.d.ts.map