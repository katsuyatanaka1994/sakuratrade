/**
 * Entry足判定 v0.4 型定義
 * 
 * 押し目ロングのエントリー足判定システムで使用する型定義
 */

/** 1本の足データ */
export type Bar = {
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
};

/** テクニカル指標データ */
export type Indicators = {
  /** 5日移動平均 */
  sma5?: number | null;
  /** 20日移動平均 */
  sma20?: number | null;
  /** 60日移動平均 */
  sma60?: number | null;
  /** 5日前の5日移動平均 */
  sma5_5ago?: number | null;
  /** 5日前の20日移動平均 */
  sma20_5ago?: number | null;
  /** 5日前の60日移動平均 */
  sma60_5ago?: number | null;
  /** 5日平均出来高 */
  volMA5?: number | null;
  /** 前日高値 */
  prevHigh?: number | null;
  /** 前日安値 */
  prevLow?: number | null;
  /** 前日終値 */
  prevClose?: number | null;
  /** 前々日高値（内包判定補助用） */
  prev2High?: number | null;
  /** 前々日安値（内包判定補助用） */
  prev2Low?: number | null;
};

/** コンテキスト情報 */
export type Context = {
  /** 直近Pivotの位置（0=当日、1=前日...） */
  recentPivotBarsAgo?: number | null;
  /** 株価帯（自動判定可能） */
  priceBand?: 'small' | 'mid' | 'large';
  /** オプション上書き */
  options?: Partial<Options>;
};

/** エントリー判定オプション */
export type Options = {
  /** Pivot有効期限（営業日） */
  pivotLookbackBars: number;
  /** 5MA近接許容誤差（%） */
  allowEpsilonOnSMA5: number;
  /** 傾き判定閾値（%） */
  slopePct: number;
  /** 20MA近接判定閾値（%） */
  nearPct20: number;
  /** 重み - MA */
  wMA: number;
  /** 重み - Candle */
  wCandle: number;
  /** 重み - Volume */
  wVolume: number;
  /** エントリー可能ライン */
  entryCutoff: number;
  /** 強エントリーライン */
  strongCutoff: number;
};

/** MA傾き判定結果 */
export type SlopeDirection = 'up' | 'flat' | 'down';

/** MAスコア詳細 */
export type MAScoreDetails = {
  /** 5MA傾きスコア */
  sma5Score: number;
  /** 20MA傾きスコア */
  sma20Score: number;
  /** 60MA傾きスコア */
  sma60Score: number;
  /** 傾き合成スコア */
  slopeScore: number;
  /** 並びボーナス */
  arrangementBonus: number;
  /** 5MA傾き% */
  sma5SlopePct: number;
  /** 20MA傾き% */
  sma20SlopePct: number;
  /** 60MA傾き% */
  sma60SlopePct: number;
  /** 並び状態 */
  isProperArrangement: boolean;
};

/** Candleパターン種別 */
export type CandlePattern = 
  | 'breakout_marubozu'
  | 'standard_breakout'
  | 'inside_breakout'
  | 'ma20_touch_reversal'
  | 'engulfing_at_ma20'
  | 'continuation_small_body'
  | 'generic_bullish'
  | 'other';

/** Candleスコア詳細 */
export type CandleScoreDetails = {
  /** 基礎パターン */
  pattern: CandlePattern;
  /** 基礎点 */
  baseScore: number;
  /** 実体比率 */
  bodyRatio: number;
  /** 上髭比率 */
  upperRatio: number;
  /** 下髭比率 */
  lowerRatio: number;
  /** CLV */
  clv: number;
  /** レンジ比率 */
  rangeRatio: number;
  /** ギャップ% */
  gapPct: number;
  /** 各補正値 */
  adjustments: {
    upperPenalty: number;
    clvAdjustment: number;
    rangeAdjustment: number;
    gapAdjustment: number;
  };
  /** 補正後スコア */
  adjustedScore: number;
};

/** Volumeスコア詳細 */
export type VolumeScoreDetails = {
  /** 出来高倍率 */
  volumeRatio: number;
  /** スコア */
  score: number;
};

/** エントリーサマリー */
export type EntrySummary = {
  /** バージョン */
  version: 'v0.4';
  /** ゲート通過フラグ */
  gatePassed: boolean;
  /** 各サブスコア（0-100） */
  scores: {
    MA: number;
    Candle: number;
    Volume: number;
  };
  /** 重み付けスコア */
  weighted: {
    MA: number;
    Candle: number;
    Volume: number;
  };
  /** 最終スコア */
  final: number;
  /** ラベル */
  label: '強エントリー' | 'エントリー可' | '見送り';
  /** 説明文 */
  explain: string;
  /** 詳細データ */
  details: {
    ma?: MAScoreDetails;
    candle?: CandleScoreDetails;
    volume?: VolumeScoreDetails;
    missing?: string[];
    gateFailures?: string[];
  };
};

/** Pivotサマリー（v1.3からの参照用） */
export type PivotSummary = {
  /** バージョン */
  version: 'v1.3';
  /** 最終スコア */
  final: number;
  /** Pivot認定フラグ */
  isPivot: boolean;
};

/** 押し目ロング総合判定結果 */
export type LongSetupResult = {
  /** 判定種別 */
  kind: '押し目ロングの型';
  /** Pivot判定結果 */
  pivot: PivotSummary;
  /** Entry判定結果 */
  entry: EntrySummary;
  /** 総合判定 */
  verdict: '推奨' | '保留' | '非推奨';
};