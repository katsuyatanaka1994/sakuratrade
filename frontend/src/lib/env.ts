type AnyEnv = Record<string, unknown> | undefined | null;

const ENV_CANDIDATES = [
  () => {
    try {
      return (import.meta as any)?.env as AnyEnv;
    } catch (_) {
      return undefined;
    }
  },
  () => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      return w?.ENV as AnyEnv;
    }
    return undefined;
  },
  () => {
    if (typeof window !== 'undefined') {
      const w = window as any;
      return w as AnyEnv;
    }
    return undefined;
  },
  () => {
    if (typeof process !== 'undefined') {
      return process.env as AnyEnv;
    }
    return undefined;
  }
];

function readEnvValue(keys: string[]): string | undefined {
  for (const getEnv of ENV_CANDIDATES) {
    const env = getEnv();
    if (!env) continue;
    for (const key of keys) {
      const value = env[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
  }
  return undefined;
}

function readMetaContent(name: string): string | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  const meta = document.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
  const content = meta?.getAttribute('content');
  return content && content.trim().length > 0 ? content : undefined;
}

function readWindowProperty(keys: string[]): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const w = window as any;
  for (const key of keys) {
    const value = w?.[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

export function resolveApiBaseUrl(fallback: string = '/api'): string {
  const envValue = readEnvValue(['VITE_API_BASE_URL', 'REACT_APP_API_URL', 'API_BASE_URL']);
  if (envValue) return envValue;

  const metaValue = readMetaContent('api-base-url');
  if (metaValue) return metaValue;

  const windowValue = readWindowProperty(['API_BASE_URL']);
  if (windowValue) return windowValue;

  return fallback;
}

export function resolveTelemetryEndpoint(fallback: string = '/api/telemetry'): string {
  const envValue = readEnvValue(['VITE_TELEMETRY_ENDPOINT', 'REACT_APP_TELEMETRY_ENDPOINT']);
  if (envValue) return envValue;

  const metaValue = readMetaContent('telemetry-endpoint');
  if (metaValue) return metaValue;

  return fallback;
}

export function isDevelopmentEnv(): boolean {
  try {
    const viteEnv = (import.meta as any)?.env;
    if (typeof viteEnv?.DEV === 'boolean') {
      return viteEnv.DEV;
    }
    if (typeof viteEnv?.MODE === 'string') {
      return viteEnv.MODE === 'development';
    }
  } catch (_) {
    // ignore when import.meta is unavailable
  }

  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string') {
    return process.env.NODE_ENV === 'development';
  }

  return false;
}

export function getEnvironmentName(): string {
  try {
    const viteEnv = (import.meta as any)?.env;
    if (typeof viteEnv?.MODE === 'string' && viteEnv.MODE.trim().length > 0) {
      return viteEnv.MODE;
    }
  } catch (_) {
    // ignore when import.meta is unavailable
  }

  if (typeof process !== 'undefined' && typeof process.env?.NODE_ENV === 'string' && process.env.NODE_ENV.trim().length > 0) {
    return process.env.NODE_ENV;
  }

  return isDevelopmentEnv() ? 'development' : 'production';
}
