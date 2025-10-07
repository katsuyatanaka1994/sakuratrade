import { useEffect, useMemo, useState } from 'react';
import { patternsApi, type ChartPatternDefinition } from '../services/patterns';
import type { ChartPattern } from '../types/chat';
import {
  CHART_PATTERNS as DEFAULT_PATTERNS,
  CHART_PATTERN_LABEL_MAP as DEFAULT_LABEL_MAP,
  DEFAULT_CHART_PATTERN_VERSION,
  buildPatternLabelMap,
  type ChartPatternOption,
} from '../constants/chartPatterns';

interface UseChartPatternsResult {
  patterns: ChartPatternOption[];
  labelMap: Record<ChartPattern, string>;
  version: string;
  loading: boolean;
  error: string | null;
}

const mapDefinitionsToOptions = (defs: ChartPatternDefinition[]): ChartPatternOption[] =>
  defs.map((def) => ({
    code: def.code,
    value: def.value,
    label: def.label,
    description: def.description,
    deprecated: def.deprecated,
  }));

export function useChartPatterns(): UseChartPatternsResult {
  const [patterns, setPatterns] = useState<ChartPatternOption[]>(() => [...DEFAULT_PATTERNS]);
  const [labelMap, setLabelMap] = useState<Record<ChartPattern, string>>({ ...DEFAULT_LABEL_MAP });
  const [version, setVersion] = useState<string>(DEFAULT_CHART_PATTERN_VERSION);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchPatterns = async () => {
      setLoading(true);
      setError(null);
      try {
        const catalog = await patternsApi.getCatalog();
        if (cancelled) return;
        const options = mapDefinitionsToOptions(catalog.patterns);
        setPatterns(options);
        setLabelMap(buildPatternLabelMap(options));
        setVersion(catalog.pattern_version ?? catalog.version);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'パターン情報の取得に失敗しました');
        setPatterns([...DEFAULT_PATTERNS]);
        setLabelMap({ ...DEFAULT_LABEL_MAP });
        setVersion(DEFAULT_CHART_PATTERN_VERSION);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchPatterns();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedPatterns = useMemo(
    () =>
      patterns.slice().sort((a, b) => {
        if (a.deprecated === b.deprecated) {
          return a.label.localeCompare(b.label, 'ja');
        }
        return a.deprecated ? 1 : -1;
      }),
    [patterns],
  );

  return { patterns: sortedPatterns, labelMap, version, loading, error };
}
