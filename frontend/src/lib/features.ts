const parseBooleanFlag = (value: unknown, defaultValue: boolean): boolean => {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).toLowerCase();
  if (['false', '0', 'off', 'no'].includes(normalized)) {
    return false;
  }
  if (['true', '1', 'on', 'yes'].includes(normalized)) {
    return true;
  }

  return defaultValue;
};

const env = typeof import.meta !== 'undefined' ? (import.meta as any).env ?? {} : {};

export const featureFlags = {
  livePositions: parseBooleanFlag(env.VITE_FEATURE_LIVE_POSITIONS, true),
};

export type FeatureFlags = typeof featureFlags;

export const isFeatureEnabled = (flag: keyof FeatureFlags): boolean => featureFlags[flag];
