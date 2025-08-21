/**
 * Entry足判定 v0.4 説明文生成
 *
 * チャット用メッセージとJSON用説明の生成
 */
import type { LongSetupResult, EntrySummary } from './types.js';
/**
 * Entry用の詳細説明を生成
 */
export declare function generateEntryExplain(entry: EntrySummary): string;
/**
 * 押し目ロング総合用の説明を生成
 */
export declare function generateLongSetupExplain(result: LongSetupResult): string;
/**
 * チャット用の短縮メッセージを生成
 */
export declare function generateChatMessage(result: LongSetupResult): string;
/**
 * 失敗理由の詳細説明を生成
 */
export declare function generateFailureDetails(result: LongSetupResult): string | null;
//# sourceMappingURL=explain.d.ts.map