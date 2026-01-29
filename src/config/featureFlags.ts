/**
 * Feature Flags
 * Controls experimental features that can be enabled/disabled via environment variables
 */

export const featureFlags = {
  elevationZones: import.meta.env.VITE_FEATURE_ELEVATION_ZONES === 'true',
} as const;
