/**
 * Pivot足判定ロジック v1.3 コア実装
 *
 * 押し目ロングのPivot足を判定する純関数群とメイン関数
 * すべての関数は副作用なし・不変データを返却
 */
import { type PriceBand } from './config.js';
/** 入力データの型定義 */
export type PivotInput = {
    /** 日付（YYYY-MM-DD形式推奨） */
    date: string;
    /** 始値 */
    open: number;
    /** 高値 */
    high: number;
    /** 安値 */
    low: number;
    /** 終値 */
    close: number;
    /** 出来高 */
    volume: number;
    /** 5日平均出来高 */
    volMA5: number;
    /** 20日移動平均（未定義可） */
    sma20?: number | null;
    /** 60日移動平均（未定義可） */
    sma60?: number | null;
    /** 5日前の20日移動平均（未定義可） */
    sma20_5ago?: number | null;
    /** 5日前の60日移動平均（未定義可） */
    sma60_5ago?: number | null;
};
/** 最終結果の型定義 */
export type PivotResult = {
    /** 各サブスコア（0-100） */
    scores: {
        candle: number;
        location: number;
        slope: number;
        volume: number;
    };
    /** 重み付け後の寄与スコア（小数1桁） */
    weighted: {
        candle: number;
        location: number;
        slope: number;
        volume: number;
    };
    /** 最終スコア（小数1桁） */
    final: number;
    /** Pivot認定フラグ */
    isPivot: boolean;
    /** 説明文字列 */
    explain: string;
    /** メタ情報 */
    meta: {
        priceBand: PriceBand;
        near20: boolean;
        near60: boolean;
        slope20pct: number;
        slope60pct: number;
        version: string;
    };
};
/** ロケーションスコア計算の中間結果 */
export type LocationResult = {
    score: number;
    near20: boolean;
    near60: boolean;
    band: PriceBand;
};
/** 傾きスコア計算の中間結果 */
export type SlopeResult = {
    score: number;
    s20pct: number;
    s60pct: number;
};
/**
 * Candleスコアを計算（0-100）
 *
 * @param open - 始値
 * @param high - 高値
 * @param low - 安値
 * @param close - 終値
 * @returns Candleスコア（0-100の整数）
 */
export declare function candleScore(open: number, high: number, low: number, close: number): number;
/**
 * 株価帯を判定
 * @param close - 終値
 * @returns 株価帯
 */
export declare function getPriceBand(close: number): PriceBand;
/**
 * Locationスコアを計算（0-100）
 *
 * @param close - 終値
 * @param sma20 - 20日移動平均（未定義可）
 * @param sma60 - 60日移動平均（未定義可）
 * @returns ロケーション計算結果
 */
export declare function locationScore(close: number, sma20?: number | null, sma60?: number | null): LocationResult;
/**
 * Slopeスコアを計算（0-100）
 *
 * @param sma20 - 現在の20日移動平均
 * @param sma20_5ago - 5日前の20日移動平均
 * @param sma60 - 現在の60日移動平均
 * @param sma60_5ago - 5日前の60日移動平均
 * @returns 傾き計算結果
 */
export declare function slopeScore(sma20?: number | null, sma20_5ago?: number | null, sma60?: number | null, sma60_5ago?: number | null): SlopeResult;
/**
 * Volumeスコアを計算（0-100）
 *
 * @param volume - 出来高
 * @param volMA5 - 5日平均出来高
 * @returns 出来高スコア（0-100の整数）
 */
export declare function volumeScore(volume: number, volMA5: number): number;
/**
 * メインのPivot足判定関数
 *
 * @param input - 入力データ
 * @returns Pivot判定結果
 */
export declare function scorePivot(input: PivotInput): PivotResult;
//# sourceMappingURL=pivotScore.d.ts.map