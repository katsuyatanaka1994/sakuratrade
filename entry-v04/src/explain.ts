/**
 * Entry足判定 v0.4 説明文生成
 * 
 * チャット用メッセージとJSON用説明の生成
 */

import type { 
  LongSetupResult, 
  EntrySummary, 
  MAScoreDetails, 
  CandleScoreDetails, 
  VolumeScoreDetails,
  CandlePattern
} from './types.js';

/**
 * Candleパターンの日本語名
 */
const PATTERN_NAMES: Record<CandlePattern, string> = {
  'breakout_marubozu': 'ブレイク・マルボウズ',
  'standard_breakout': '標準ブレイク',
  'inside_breakout': 'インサイド上放れ',
  'ma20_touch_reversal': '20MAタッチ反転',
  'engulfing_at_ma20': 'エンガルフィング@20MA',
  'continuation_small_body': '続伸・小実体',
  'generic_bullish': '汎用陽線',
  'other': 'その他',
};

/**
 * MAの状態説明を生成
 */
function describeMAStatus(details: MAScoreDetails): string {
  const slopes = [];
  
  if (details.sma5SlopePct >= 0.5) slopes.push('5↗');
  else if (details.sma5SlopePct <= -0.5) slopes.push('5↘');
  else slopes.push('5→');
  
  if (details.sma20SlopePct >= 0.5) slopes.push('20↗');
  else if (details.sma20SlopePct <= -0.5) slopes.push('20↘');
  else slopes.push('20→');
  
  if (details.sma60SlopePct >= 0.5) slopes.push('60↗');
  else if (details.sma60SlopePct <= -0.5) slopes.push('60↘');
  else slopes.push('60→');
  
  const arrangement = details.isProperArrangement ? '順調' : '混在';
  
  return `${slopes.join('>')} ${arrangement}`;
}

/**
 * Candleの状態説明を生成
 */
function describeCandleStatus(details: CandleScoreDetails): string {
  const patternName = PATTERN_NAMES[details.pattern] || details.pattern;
  
  const adjustments = [];
  if (details.adjustments.upperPenalty < 0) adjustments.push('上髭ペナ');
  if (details.adjustments.clvAdjustment > 0) adjustments.push('CLV+');
  if (details.adjustments.clvAdjustment < 0) adjustments.push('CLV-');
  if (details.adjustments.rangeAdjustment > 0) adjustments.push('拡大+');
  if (details.adjustments.rangeAdjustment < 0) adjustments.push('縮小-');
  if (details.adjustments.gapAdjustment < 0) adjustments.push('ギャップ失速');
  
  if (adjustments.length > 0) {
    return `${patternName}(${adjustments.join(',')})`;
  }
  
  return patternName;
}

/**
 * 出来高の状態説明を生成
 */
function describeVolumeStatus(details: VolumeScoreDetails): string {
  const ratio = details.volumeRatio;
  
  if (ratio >= 2.0) return `${ratio.toFixed(1)}× 大幅増`;
  if (ratio >= 1.5) return `${ratio.toFixed(1)}× 増加`;
  if (ratio >= 1.2) return `${ratio.toFixed(1)}× やや増`;
  if (ratio >= 0.8) return `${ratio.toFixed(1)}× 標準`;
  return `${ratio.toFixed(1)}× 減少`;
}

/**
 * Entry用の詳細説明を生成
 */
export function generateEntryExplain(entry: EntrySummary): string {
  if (!entry.gatePassed) {
    const failures = entry.details.gateFailures || [];
    return `Entry ${entry.final}点 - ゲート未通過: ${failures.join(', ')}`;
  }
  
  const maDesc = entry.details.ma ? describeMAStatus(entry.details.ma) : 'MA不明';
  const candleDesc = entry.details.candle ? describeCandleStatus(entry.details.candle) : 'Candle不明';
  const volDesc = entry.details.volume ? describeVolumeStatus(entry.details.volume) : 'Vol不明';
  
  return `Entry ${entry.final}点（${entry.label}）- MA:${maDesc}, Candle:${candleDesc}, Vol:${volDesc}`;
}

/**
 * 押し目ロング総合用の説明を生成
 */
export function generateLongSetupExplain(result: LongSetupResult): string {
  const pivotStatus = result.pivot.isPivot ? 
    `Pivot ${result.pivot.final}/認定` : 
    `Pivot ${result.pivot.final}/非認定`;
  
  const entryDesc = generateEntryExplain(result.entry);
  
  const verdictEmoji = {
    '推奨': '✅',
    '保留': '⏸️',
    '非推奨': '❌',
  }[result.verdict];
  
  return `[押し目ロングの型] ${pivotStatus}, ${entryDesc} → ${verdictEmoji}${result.verdict}`;
}

/**
 * チャット用の短縮メッセージを生成
 */
export function generateChatMessage(result: LongSetupResult): string {
  const pivot = result.pivot.isPivot ? '○' : '×';
  const entry = result.entry.label === '見送り' ? '×' : 
               result.entry.label === 'エントリー可' ? '△' : '○';
  
  const ma = result.entry.details.ma?.isProperArrangement ? '順調' : '混在';
  const pattern = result.entry.details.candle ? 
    PATTERN_NAMES[result.entry.details.candle.pattern] : '不明';
  const vol = result.entry.details.volume ? 
    `${result.entry.details.volume.volumeRatio.toFixed(1)}×` : '不明';
  
  return `Pivot${pivot} Entry${entry} (MA:${ma}, ${pattern}, Vol:${vol}) → ${result.verdict}`;
}

/**
 * 失敗理由の詳細説明を生成
 */
export function generateFailureDetails(result: LongSetupResult): string | null {
  const issues = [];
  
  // Pivot失敗
  if (!result.pivot.isPivot) {
    issues.push(`Pivot認定失敗（${result.pivot.final}点/65点未満）`);
  }
  
  // Entry失敗
  if (!result.entry.gatePassed) {
    const failures = result.entry.details.gateFailures || [];
    issues.push(`Entryゲート失敗: ${failures.join(', ')}`);
  } else if (result.entry.label === '見送り') {
    issues.push(`Entryスコア不足（${result.entry.final}点/70点未満）`);
  }
  
  // 欠損データ
  const missing = result.entry.details.missing || [];
  if (missing.length > 0) {
    issues.push(`データ欠損: ${missing.join(', ')}`);
  }
  
  return issues.length > 0 ? issues.join('\n') : null;
}