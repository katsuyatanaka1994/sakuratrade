import type { ChartPattern } from '../types/chat';

export interface ChartPatternOption {
  value: ChartPattern;
  label: string;
  code: string;
  description?: string;
  deprecated?: boolean;
}

export const DEFAULT_CHART_PATTERN_VERSION = 'fallback-2025.10';

export const CHART_PATTERNS: ReadonlyArray<ChartPatternOption> = [
  { code: 'PULLBACK_BUY', value: 'pullback-buy', label: '押し目買い' },
  { code: 'RETEST_SHORT', value: 'retest-short', label: '戻り売り' },
  { code: 'BREAKOUT', value: 'breakout', label: 'ブレイクアウト' },
  { code: 'DOUBLE_BOTTOM', value: 'double-bottom', label: 'ダブルボトム' },
  { code: 'TREND_FOLLOW', value: 'trend-follow', label: 'トレンドフォロー' },
];

export const CHART_PATTERN_LABEL_MAP: Record<ChartPattern, string> = CHART_PATTERNS.reduce(
  (acc, pattern) => {
    acc[pattern.value] = pattern.label;
    return acc;
  },
  {} as Record<ChartPattern, string>
);

export const buildPatternLabelMap = (patterns: ReadonlyArray<ChartPatternOption>) =>
  patterns.reduce<Record<ChartPattern, string>>((acc, pattern) => {
    acc[pattern.value] = pattern.label;
    return acc;
  }, {} as Record<ChartPattern, string>);
