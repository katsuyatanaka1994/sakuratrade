import type { ChartPattern } from '../types/chat';

export const CHART_PATTERNS = [
  { value: 'pullback-buy', label: '押し目買い' },
  { value: 'retest-short', label: '戻り売り' },
  { value: 'breakout', label: 'ブレイクアウト' },
  { value: 'double-bottom', label: 'ダブルボトム' },
  { value: 'trend-follow', label: 'トレンドフォロー' },
] as const satisfies ReadonlyArray<{ value: ChartPattern; label: string }>;

export const CHART_PATTERN_LABEL_MAP: Record<ChartPattern, string> = CHART_PATTERNS.reduce(
  (acc, pattern) => {
    acc[pattern.value] = pattern.label;
    return acc;
  },
  {} as Record<ChartPattern, string>
);
