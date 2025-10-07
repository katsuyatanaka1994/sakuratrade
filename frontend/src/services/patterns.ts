import { isDevelopmentEnv, resolveApiBaseUrl } from '../lib/env';

export interface ChartPatternDefinition {
  code: string;
  value: string;
  label: string;
  description?: string;
  deprecated?: boolean;
}

export interface ChartPatternCatalog {
  pattern_version?: string;
  version: string;
  patterns: ChartPatternDefinition[];
}

const API_BASE = resolveApiBaseUrl(isDevelopmentEnv() ? 'http://localhost:8000' : '');

export const patternsApi = {
  async getCatalog(): Promise<ChartPatternCatalog> {
    const response = await fetch(`${API_BASE}/patterns`);
    if (!response.ok) {
      throw new Error(`Failed to fetch pattern catalog: ${response.status}`);
    }
    return await response.json();
  },
};
